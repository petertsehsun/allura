import logging
import warnings
from datetime import datetime, timedelta

from pylons import c, g, request
import pkg_resources
from webob import exc
from pymongo import bson

from ming import schema as S
from ming.orm.base import mapper, session
from ming.orm.mapped_class import MappedClass
from ming.orm.property import FieldProperty, RelationProperty, ForeignIdProperty
from ming.orm.ormsession import ThreadLocalORMSession

from pyforge.lib.helpers import push_config
from .session import main_doc_session, main_orm_session
from .session import project_doc_session, project_orm_session

log = logging.getLogger(__name__)

class SearchConfig(MappedClass):
    class __mongometa__:
        session = main_orm_session
        name='search_config'

    _id = FieldProperty(S.ObjectId)
    last_commit = FieldProperty(datetime, if_missing=datetime.min)
    pending_commit = FieldProperty(int, if_missing=0)

    def needs_commit(self):
        now = datetime.utcnow()
        elapsed = now - self.last_commit
        td_threshold = timedelta(seconds=60)
        return elapsed > td_threshold and self.pending_commit

class ScheduledMessage(MappedClass):
    class __mongometa__:
        session = main_orm_session
        name='scheduled_message'

    _id = FieldProperty(S.ObjectId)
    when = FieldProperty(datetime)
    exchange = FieldProperty(str)
    routing_key = FieldProperty(str)
    data = FieldProperty(None)
    nonce = FieldProperty(S.ObjectId, if_missing=None)

    @classmethod
    def fire_when_ready(cls):
        now = datetime.utcnow()
        # Lock the objects to fire
        nonce = bson.ObjectId()
        m = mapper(cls)
        session(cls).impl.update_partial(
            m.doc_cls,
            {'when' : { '$lt':now},
             'nonce': None },
            {'$set': {'nonce':nonce}},
            False)
        # Actually fire
        for obj in cls.query.find(dict(nonce=nonce)):
            log.info('Firing scheduled message to %s:%s',
                     obj.exchange, obj.routing_key)
            try:
                g.publish(obj.exchange, obj.routing_key, getattr(obj, 'data', None))
                obj.delete()
            except: # pragma no cover
                log.exception('Error when firing %r', obj)

class Neighborhood(MappedClass):
    '''Provide a grouping of related projects.

    url_prefix - location of neighborhood (may include scheme and/or host)
    css - block of CSS text to add to all neighborhood pages
    acl - list of user IDs who have rights to perform ops on neighborhood.  Empty
        acl implies that any authenticated user can perform the op
        'read' - access the neighborhood (usually [ User.anonymous()._id ])
        'create' - create projects within the neighborhood (open neighborhoods
            will typically have this empty)
        'moderate' - invite projects into the neighborhood, evict projects from
            the neighborhood
        'admin' - update neighborhood ACLs, acts as a superuser with all
            permissions in neighborhood projects
    '''
    class __mongometa__:
        session = main_orm_session
        name = 'neighborhood'

    _id = FieldProperty(S.ObjectId)
    name = FieldProperty(str)
    url_prefix = FieldProperty(str) # e.g. http://adobe.openforge.com/ or projects/
    shortname_prefix = FieldProperty(str, if_missing='')
    css = FieldProperty(str, if_missing='')
    homepage = FieldProperty(str, if_missing='')
    acl = FieldProperty({
            'read':[S.ObjectId],      # access neighborhood at all
            'create':[S.ObjectId],    # create project in neighborhood
            'moderate':[S.ObjectId],    # invite/evict projects
            'admin':[S.ObjectId],  # update ACLs
            })
    projects = RelationProperty('Project')

    def url(self):
        url = self.url_prefix
        if url.startswith('//'):
            try:
                return request.scheme + ':' + url
            except TypeError: # pragma no cover
                return 'http:' + url
        else:
            return url

    def register_project(self, shortname, user=None):
        '''Register a new project in the neighborhood.  The given user will
        become the project's superuser.  If no user is specified, c.user is used.
        '''
        from . import auth
        if user is None: user = c.user
        p = Project.query.get(shortname=shortname)
        if p:
            assert p.neighborhood == self, (
                'Project %s exists in neighborhood %s' % (
                    shortname, p.neighborhood.name))
            return p
        database = 'project:' + shortname.replace('/', ':').replace(' ', '_')
        try:
            p = Project(neighborhood_id=self._id,
                        shortname=shortname,
                        name=shortname,
                        short_description='Please update with a short description',
                        description=(shortname + '\n'
                                     + '=' * 80 + '\n\n'
                                     + 'You can edit this description in the admin page'),
                        database=database,
                        is_root=True)
            with push_config(c, project=p, user=user):
                pr = user.project_role()
                for roles in p.acl.itervalues():
                    roles.append(pr._id)
                pr = auth.ProjectRole(name='*anonymous')
                p.acl.read.append(pr._id)
                auth.ProjectRole(name='*authenticated')
                p.install_app('home', 'home')
                p.install_app('admin', 'admin')
                p.install_app('search', 'search')
                ThreadLocalORMSession.flush_all()
        except:
            ThreadLocalORMSession.close_all()
            p.delete()
            raise
        return p

    def bind_controller(self, controller):
        from pyforge.controllers.project import NeighborhoodController
        controller_attr = self.url_prefix[1:-1]
        setattr(controller, controller_attr, NeighborhoodController(
                self.name, self.shortname_prefix))

class Project(MappedClass):
    class __mongometa__:
        session = main_orm_session
        name='project'

    # Project schema
    _id=FieldProperty(S.ObjectId)
    parent_id = FieldProperty(S.ObjectId, if_missing=None)
    neighborhood_id = ForeignIdProperty(Neighborhood)
    shortname = FieldProperty(str)
    name=FieldProperty(str)
    short_description=FieldProperty(str, if_missing='')
    description=FieldProperty(str, if_missing='')
    database=FieldProperty(str)
    is_root=FieldProperty(bool)
    acl = FieldProperty({
            'create':[S.ObjectId],    # create subproject
            'read':[S.ObjectId],      # read project
            'update':[S.ObjectId],    # update project metadata
            'delete':[S.ObjectId],    # delete project, subprojects
            'plugin':[S.ObjectId],    # install/delete/configure plugins
            'security':[S.ObjectId],  # update ACL, roles
            })
    neighborhood_invitations=FieldProperty([S.ObjectId])
    neighborhood = RelationProperty(Neighborhood)
    app_configs = RelationProperty('AppConfig')

    def sidebar_menu(self):
        from pyforge.app import SitemapEntry
        result = []
        if not self.is_root:
            p = self.parent_project
            result.append(SitemapEntry('Parent Project'))
            result.append(SitemapEntry(p.name or p.script_name, p.script_name))
        sps = self.direct_subprojects
        if sps:
            result.append(SitemapEntry('Child Projects'))
            result += [
                SitemapEntry(p.name or p.script_name, p.script_name)
                for p in sps ]
        return result

    @property
    def script_name(self):
        url = self.url()
        if '//' in url:
            return url.rsplit('//')[-1]
        else:
            return url

    def url(self):
        url = self.neighborhood.url_prefix + self.shortname + '/'
        if url.startswith('//'):
            try:
                return request.scheme + ':' + url
            except TypeError: # pragma no cover
                return 'http:' + url
        else:
            return url

    @property
    def description_html(self):
        return g.markdown.convert(self.description)

    @property
    def parent_project(self):
        if self.is_root: return None
        return self.query.get(_id=self.parent_id)

    def sitemap(self):
        from pyforge.app import SitemapEntry
        sitemap = SitemapEntry('root')
        for ac in self.app_configs:
            App = ac.load()
            app = App(self, ac)
            app_sitemap = [ sm.bind_app(app) for sm in app.sitemap ]
            sitemap.extend(app_sitemap)
        return sitemap.children

    def parent_iter(self):
        yield self
        pp = self.parent_project
        if pp:
            for p in pp.parent_iter():
                yield p

    @property
    def subprojects(self):
        q = self.query.find(dict(shortname={'$gt':self.shortname})).sort('shortname')
        for project in q:
            if project.shortname.startswith(self.shortname + '/'):
                yield project
            else:
                break

    @property
    def direct_subprojects(self):
        return self.query.find(dict(parent_id=self._id))

    @property
    def roles(self):
        from . import auth
        roles = auth.ProjectRole.query.find().all()
        return sorted(roles, key=lambda r:r.display())

    def install_app(self, ep_name, mount_point, **override_options):
        assert self.app_instance(mount_point) is None
        for ep in pkg_resources.iter_entry_points('pyforge', ep_name):
            App = ep.load()
            break
        else: # pragma no cover
            raise exc.HTTPNotFound, ep_name
        options = App.default_options()
        options['mount_point'] = mount_point
        options.update(override_options)
        cfg = AppConfig(
            project_id=self._id,
            plugin_name=ep_name,
            options=options,
            acl=dict((p,[]) for p in App.permissions))
        app = App(self, cfg)
        with push_config(c, project=self, app=app):
            session(cfg).flush()
            app.install(self)
        return app

    def uninstall_app(self, mount_point):
        app = self.app_instance(mount_point)
        if app is None: return
        with push_config(c, project=self, app=app):
            app.uninstall(self)
        app.config.delete()

    def app_instance(self, mount_point_or_config):
        if isinstance(mount_point_or_config, AppConfig):
            app_config = mount_point_or_config
        else:
            app_config = self.app_config(mount_point_or_config)
        if app_config is None:
            return None
        App = app_config.load()
        if App is None: # pragma no cover
            return None
        else:
            return App(self, app_config)

    def app_config(self, mount_point):
        return AppConfig.query.find({
                'project_id':self._id,
                'options.mount_point':mount_point}).first()

    def new_subproject(self, name, install_apps=True):
        shortname = self.shortname + '/' + name
        sp = Project(
            parent_id=self._id,
            neighborhood_id=self.neighborhood_id,
            shortname=shortname,
            name=name,
            database=self.database,
            is_root=False)
        with push_config(c, project=sp):
            AppConfig.query.remove(dict(project_id=c.project._id))
            if install_apps:
                sp.install_app('home', 'home')
                sp.install_app('admin', 'admin')
                sp.install_app('search', 'search')
        return sp

    def delete(self):
        # Cascade to subprojects
        for sp in self.direct_subprojects:
            sp.delete()
        # Cascade to app configs
        for ac in self.app_configs:
            ac.delete()
        MappedClass.delete(self)

    def render_widget(self, widget):
        app = self.app_instance(widget['mount_point'])
        with push_config(c, project=self, app=app):
            return getattr(app.widget(app), widget['widget_name'])()

    def breadcrumbs(self):
        entry = ( self.name, self.url() )
        if self.parent_project:
            return self.parent_project.breadcrumbs() + [ entry ]
        else:
            return [ (self.neighborhood.name, self.neighborhood.url())] + [ entry ]

class AppConfig(MappedClass):
    class __mongometa__:
        session = project_orm_session
        name='config'

    # AppConfig schema
    _id=FieldProperty(S.ObjectId)
    project_id=ForeignIdProperty(Project)
    plugin_name=FieldProperty(str)
    version=FieldProperty(str)
    options=FieldProperty(None)
    project = RelationProperty(Project, via='project_id')


    # acl[permission] = [ role1, role2, ... ]
    acl = FieldProperty({str:[S.ObjectId]}) 

    def load(self):
        for ep in pkg_resources.iter_entry_points(
            'pyforge', self.plugin_name):
            return ep.load()
        return None

    def script_name(self):
        return self.project.script_name + self.options.mount_point + '/'

    def url(self):
        return self.project.url() + self.options.mount_point + '/'

    def breadcrumbs(self):
        return self.project.breadcrumbs() + [
            (self.options.mount_point, self.url()) ]
            
