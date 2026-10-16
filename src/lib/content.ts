import {readdirSync, readFileSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {parse} from 'yaml';
import MarkdownIt from 'markdown-it';

export const base = '/hive';
export function url(path = '/') { return path.startsWith(base + '/') ? path : base + (path.startsWith('/') ? path : '/' + path); }
export const sections = [
 {id:'product',title:'认识蜂巢',label:'产品',description:'从真实工作理解员工数字分身。'},
 {id:'architecture',title:'架构与设计',label:'架构',description:'了解一项任务如何穿过系统，结果保存在哪里。'},
 {id:'employee',title:'员工工作台手册',label:'员工手册',description:'从第一次登录，到用技能和自动化完成日常工作。'},
 {id:'admin',title:'管理员控制台手册',label:'管理员手册',description:'准备人员、模型与企业能力，管理平台运行。'},
 {id:'developers',title:'开发与对接',label:'开发对接',description:'使用开放API，让业务系统、技能和面板接入蜂巢。'},
 {id:'insights',title:'交流与实践',label:'交流',description:'理解设计取舍、业务例子与持续建设的方法。'},
] as const;
export type SectionId = typeof sections[number]['id'];
export interface Doc {slug:string;title:string;description:string;section:SectionId;order:number;updated:string;sources:string[];body:string;words:number;minutes:number;}
function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):e.name.endsWith('.md')?[resolve(dir,e.name)]:[]);}
let cached:Doc[];
export function getDocs():Doc[]{
 if(cached)return cached;
 const root=resolve('content');
 cached=walk(root).map(file=>{
  const match=readFileSync(file,'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if(!match)throw new Error('正文缺少前置信息：'+file);
  const data=parse(match[1]);const content=match[2];
  const slug=relative(root,file).replaceAll('\\','/').replace(/\.md$/,'');
  if(!data.title||!data.description||!sections.some(s=>s.id===data.section)||!Number.isFinite(data.order)||!data.updated||!Array.isArray(data.sources))throw new Error('正文信息不完整：'+slug);
  const words=content.replace(/\s/g,'').length;
  return {slug,title:String(data.title),description:String(data.description),section:data.section,order:Number(data.order),updated:data.updated instanceof Date?data.updated.toISOString().slice(0,10):String(data.updated),sources:data.sources,body:content,words,minutes:Math.max(2,Math.ceil(words/600))};
 }).sort((a,b)=>sections.findIndex(s=>s.id===a.section)-sections.findIndex(s=>s.id===b.section)||a.order-b.order);
 return cached;
}
export function docUrl(doc:Doc){return url('/docs/'+doc.slug+'/');}
export function sectionDocs(id:string){return getDocs().filter(d=>d.section===id);}
export function plainText(value:string){return value.replace(/```[^\n]*\n([\s\S]*?)```/g,' $1 ').replace(/!\[([^\]]*)\]\([^)]*\)/g,' $1 ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[>#*`|_]/g,' ').replace(/\s+/g,' ').trim();}
export interface Heading {id:string;text:string;depth:number;}
export function renderDoc(source:string){
 source=source.replace(/^\s*# [^\n]+(?:\n|$)/,'');
 const headings:Heading[]=[];const counts=new Map<string,number>();
 const md=new MarkdownIt({html:false,linkify:false,typographer:false});
 md.renderer.rules.heading_open=(tokens,index,options,_env,self)=>{
  const text=tokens[index+1]?.content??'';const stem=text.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu,'').replace(/ /g,'-');const count=counts.get(stem)??0;counts.set(stem,count+1);const id=stem+(count?'-'+count:'');tokens[index].attrSet('id',id);headings.push({id,text,depth:Number(tokens[index].tag.slice(1))});return self.renderToken(tokens,index,options);
 };
 md.renderer.rules.link_open=(tokens,index,options,_env,self)=>{const token=tokens[index];const href=String(token.attrGet('href')??'');if(href.startsWith('/')&&!href.startsWith('//'))token.attrSet('href',url(href));if(href.startsWith('https://')&&!href.startsWith('https://www.bluexiii.com')){token.attrSet('target','_blank');token.attrSet('rel','noopener noreferrer');}return self.renderToken(tokens,index,options);};
 md.renderer.rules.image=(tokens,index)=>{const token=tokens[index];const src=String(token.attrGet('src')??'');const href=src.startsWith('/')?url(src):src;const alt=md.utils.escapeHtml(token.content);return `<figure class="doc-figure"><button type="button" class="image-zoom" data-image-zoom aria-label="放大图片：${alt}"><img src="${md.utils.escapeHtml(href)}" alt="${alt}" loading="lazy" decoding="async" width="1440" height="1100" /></button><figcaption>${alt}<span>点击放大 ↗</span></figcaption></figure>`;};
 md.renderer.rules.fence=(tokens,index)=>{const token=tokens[index],lang=md.utils.escapeHtml(token.info.trim()||'text');return `<div class="code-window"><div class="code-toolbar"><span>${lang}</span><button type="button" data-copy-code>复制代码</button></div><pre tabindex="0"><code class="language-${lang}">${md.utils.escapeHtml(token.content)}</code></pre></div>`;};
 return {html:md.render(source),headings:headings.filter(h=>h.depth===2||h.depth===3)};
}
