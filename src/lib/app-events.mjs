import {validEvent, eventPeriod} from './events.mjs';
import {EVENT_RECHECK_MS} from '../../config/events.mjs';
import {deadlineFields} from '../event-deadline.js';

// Public fields only. Evidence hashes and private review notes are not app content.
export function appEventSnapshot(snapshot) {
  const events = (snapshot.events || []).filter(validEvent).map(event => {
    const item = {origin:'events'};
    for (const key of ['id','title','startDate','endDate','prefecture','venue','kind','sourceName','sourceUrl','detailUrl','organizer','time','fee','target','status','description','verification','verifiedAt','sourceStatus','communication']) {
      if (event[key] != null) item[key] = event[key];
    }
    item.webUrl = `https://deafnavi.com/events/${event.id}/`;
    Object.assign(item, deadlineFields(event));
    item.validUntil = new Date(Date.parse(event.verifiedAt) + EVENT_RECHECK_MS).toISOString();
    item.period = eventPeriod(event);
    item.thumbnailURL = event.thumbnail?.url;
    return item;
  });
  return {schemaVersion:'deaf-navi-events.v1', generatedAt:snapshot.checkedAt, events, count:events.length};
}
