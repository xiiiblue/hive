import {getDocs,sections,docUrl,plainText} from '../lib/content';
export function GET(){return new Response(JSON.stringify(getDocs().map(d=>({title:d.title,description:d.description,section:sections.find(s=>s.id===d.section)!.label,url:docUrl(d),content:plainText(d.body)}))),{headers:{'content-type':'application/json; charset=utf-8'}});}
