// Shared discovery/comparison/attention boundary. Dates are Japan calendar days.
export const curationJstDay=now=>new Date(now+9*3600000).toISOString().slice(0,10);
export function curationHorizonEnd({kind,eventKind,now=Date.now()}){
  const today=curationJstDay(now),end=new Date(today+'T00:00:00Z');
  if(kind==='cafe'){
    // Four calendar months, clamping October 31 to February's last day.
    const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+4);
    const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
    end.setUTCDate(Math.min(day,last));
  }else if(eventKind==='theater')end.setUTCMonth(end.getUTCMonth()+6);
  else end.setUTCDate(end.getUTCDate()+42);
  return end.toISOString().slice(0,10);
}
