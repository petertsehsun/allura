import logging

from pylons import c

from forgediscussion import model as DM

log = logging.getLogger(__name__)

def calc_forum_stats(shortname):
    forum = DM.Forum.query.get(
        shortname=shortname, app_config_id=c.app.config._id)
    if forum is None:
        log.error("Error looking up forum: %r", shortname)
        return
    forum.update_stats()

def calc_thread_stats(thread_id):
    thread = DM.ForumThread.query.get(_id=thread_id)
    if thread is None:
        log.error("Error looking up thread: %r", thread_id)
    thread.update_stats()
