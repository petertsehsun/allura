from tg import expose, redirect, flash, config
from pyforge.lib import search

class SearchController(object):

    @expose('pyforge.templates.search_index')
    def index(self, q=None):
        results = []
        count=0
        if q is None:
            q = ''
        else:
            results = search.search(q=q)
            if results: count=results.hits
        return dict(q=q, results=results or [], count=count)

