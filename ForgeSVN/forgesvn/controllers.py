from tg import expose, redirect
from tg.decorators import with_trailing_slash
from pylons import c

from allura.controllers import repository

class BranchBrowser(repository.BranchBrowser):

    def __init__(self):
        super(BranchBrowser, self).__init__(None)

    @expose('jinja:svn/index.html')
    @with_trailing_slash
    def index(self, limit=None, page=0, count=0, **kw):
        latest = c.app.repo.latest(branch=self._branch)
        if not latest:
            return dict(allow_fork=False, log=[])
        redirect(latest.url() + 'tree/')

    @expose()
    def _lookup(self, rev, *remainder):
        return repository.CommitBrowser(rev), remainder

# from tg import expose, url, override_template, redirect
# from tg.decorators import with_trailing_slash, without_trailing_slash
# from pylons import c
# from webob import exc

# from allura.controllers import repository
# from allura.lib.security import require, has_artifact_access

# from .widgets import SVNRevisionWidget, SVNLog

# revision_widget = SVNRevisionWidget()
# log_widget = SVNLog()

# def on_import():
#     BranchBrowser.CommitBrowserClass = CommitBrowser
#     # CommitBrowser.TreeBrowserClass = TreeBrowser
#     # TreeBrowser.FileBrowserClass = FileBrowser

# class BranchBrowser(repository.BranchBrowser):

#     def _check_security(self):
#         require(has_artifact_access('read', c.app.repo))

#     def __init__(self):
#         super(BranchBrowser, self).__init__(None)

#     @expose('jinja:svn/index.html')
#     @with_trailing_slash
#     def index(self):
#         latest = c.app.repo.latest(branch=None)
#         if not latest:
#             return dict(log=[])
#         redirect(latest.url()+'tree/')

#     @expose('jinja:svn/log.html')
#     @with_trailing_slash
#     def log(self, limit=None, page=0, count=0, **kw):
#         c.log_widget=log_widget
#         return super(BranchBrowser, self).index(limit, page, count)

#     @expose()
#     def _lookup(self, rev, *remainder):
#         return CommitBrowser(rev), remainder

# class CommitBrowser(repository.CommitBrowser):
#     revision_widget = SVNRevisionWidget()

#     @expose('jinja:svn/commit.html')
#     @with_trailing_slash
#     def index(self, **kw):
#         result = super(CommitBrowser, self).index()
#         c.revision_widget = revision_widget
#         return result

# # class TreeBrowser(repository.TreeBrowser):

# #     @expose('jinja:svn/tree.html')
# #     @with_trailing_slash
# #     def index(self, **kw):
# #         return super(TreeBrowser, self).index()

# # class FileBrowser(repository.FileBrowser):

# #     @expose('jinja:svn/file.html')
# #     @without_trailing_slash
# #     def index(self, **kw):
# #         if 'diff' in kw:
# #             override_template(self.index, 'jinja:svn/diff.html')
# #             return self.diff(int(kw['diff']))
# #         result = super(FileBrowser, self).index(**kw)
# #         return result

# on_import()
