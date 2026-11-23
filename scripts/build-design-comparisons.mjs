/** Rebuild four editorial studies from the existing Mermaid content, without changing the renderer. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { compileDocument } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/build-design-comparisons.mjs <diagram-design checkout>');
const reference = resolve(process.argv[2]);
const commit = execFileSync('git', ['-C', reference, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const target = join(root, 'examples/public/reference/diagram-design');
mkdirSync(target, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

const color = { paper:'#f5f5f5', secondary:'#ececec', ink:'#2d3142', muted:'#4f5d75', soft:'#5a6580', accent:'#bf4520', tint:'rgba(191,69,32,0.08)', rule:'rgba(45,49,66,0.12)', link:'#2e5aa8' };
const fonts = { sans:"'Geist', 'Noto Sans TC', 'Microsoft YaHei', system-ui, sans-serif", mono:"'Geist Mono', ui-monospace, monospace" };
const fontLink = readFileSync(join(reference,'skills/diagram-design/assets/template.html'),'utf8').match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];
const text = (x,y,value,{size=12,tone='ink',weight=400,anchor='start',mono=false,attrs=''}={}) => `<text x="${x}" y="${y}" fill="${color[tone]}" font-size="${size}" font-weight="${weight}" font-family="${escape(mono?fonts.mono:fonts.sans)}" text-anchor="${anchor}" ${attrs}>${escape(value)}</text>`;
const rect = (x,y,w,h,fill=color.paper,stroke=color.muted,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.2" ${extra}/>`;
const plain = value => String(value).replace(/<br\s*\/?\s*>/gi, '\n');

function rounded(points) {
  let path = `M ${points[0].join(' ')}`;
  for(let i=1;i<points.length-1;i++){
    const [a,b,c]=[points[i-1],points[i],points[i+1]];
    if(a[0]!==b[0]&&a[1]!==b[1]||b[0]!==c[0]&&b[1]!==c[1])throw new Error('A study route must be orthogonal');
    if(a[0]===b[0]&&b[0]===c[0]||a[1]===b[1]&&b[1]===c[1]){path+=` L ${b.join(' ')}`;continue;}
    const r=Math.min(8,Math.hypot(b[0]-a[0],b[1]-a[1])/2,Math.hypot(c[0]-b[0],c[1]-b[1])/2);
    path+=` L ${b[0]-Math.sign(b[0]-a[0])*r} ${b[1]-Math.sign(b[1]-a[1])*r} Q ${b.join(' ')} ${b[0]+Math.sign(c[0]-b[0])*r} ${b[1]+Math.sign(c[1]-b[1])*r}`;
  }
  return path+` L ${points.at(-1).join(' ')}`;
}

function labelLines(value) {
  const result=[];let line='';
  for(let word of value.split(/\s+/)){
    if(line&&(line+' '+word).length>14){result.push(line);line='';}
    while(word.length>14 && !line){result.push(word.slice(0,14));word=word.slice(14);}
    line+=(line?' ':'')+word;
  }
  if(line)result.push(line);return result;
}

function edgeLabel(value, cx, cy, tone='muted') {
  if(!value)return '';
  const lines=labelLines(value),height=lines.length*12+4,width=Math.ceil((Math.max(...lines.map(v=>v.length))*5+16)/4)*4;
  return `<g data-role="edge-label"><rect x="${cx-width/2}" y="${cy-height/2}" width="${width}" height="${height}" rx="2" fill="${color.paper}"/>${lines.map((line,i)=>text(cx,cy-height/2+12+i*12,line.toUpperCase(),{size:8,tone,anchor:'middle',mono:true})).join('')}</g>`;
}

function pathEdge(id, from, to, points, {dashed=false,tone='muted',open=false,arrow=true,label='',labelAt}={}) {
  return `<g data-edge-id="${escape(id)}" data-from="${escape(from)}" data-to="${escape(to)}"><path d="${rounded(points)}" fill="none" stroke="${color[tone]}" stroke-width="${tone==='accent'?1.8:1.2}"${dashed?' stroke-dasharray="5 4"':''}${arrow?` marker-end="url(#arrow-${open?'open':tone})"`:''}/>${labelAt?edgeLabel(label,...labelAt,tone):''}</g>`;
}

function box(id, value, p, {tag='SERVICE',focal=false,store=false,external=false,subtitle=true}={}) {
  const [x,y,w,h]=p,[name,...notes]=plain(value).split('\n');
  const fill=focal?color.tint:store?color.secondary:color.paper;
  return `<g data-node-id="${escape(id)}">${rect(x,y,w,h,fill,focal?color.accent:color.muted,`data-role="bounds"${external?' stroke-dasharray="4 3"':''}`)}${text(x+12,y+16,tag,{size:8,tone:focal?'accent':'soft',mono:true})}${text(x+w/2,y+(notes.length&&subtitle?36:38),name,{weight:600,anchor:'middle'})}${subtitle?notes.map((line,i)=>text(x+w/2,y+52+i*12,line,{size:9,tone:'muted',mono:true,anchor:'middle'})).join(''):''}</g>`;
}

function zone(id,title,p) {
  const[x,y,w,h]=p;
  return `<g data-zone-id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="rgba(45,49,66,0.02)" stroke="${color.rule}" stroke-dasharray="4 4"/>${text(x+20,y+24,title,{size:8,tone:'soft',mono:true})}</g>`;
}

function legend(y, items) {
  return `<line x1="40" y1="${y}" x2="1240" y2="${y}" stroke="${color.rule}"/>${text(40,y+20,'LEGEND',{size:8,tone:'muted',mono:true})}${items.map((item,i)=>{
    const x=136+i*240;
    return item.line?`<line x1="${x}" y1="${y+16}" x2="${x+28}" y2="${y+16}" stroke="${color[item.tone||'muted']}" stroke-width="1.2"${item.dashed?' stroke-dasharray="5 4"':''}/>${text(x+40,y+20,item.name,{size:10,tone:'muted'})}`:`<rect x="${x}" y="${y+6}" width="14" height="14" rx="2" fill="${item.focal?color.tint:color.secondary}" stroke="${item.focal?color.accent:color.muted}"/>`+text(x+24,y+20,item.name,{size:10,tone:'muted'});
  }).join('')}`;
}

async function parse(slug) {
  const file=`examples/compare/${slug}.md`,bytes=readFileSync(join(root,file)),model=compileDocument(bytes.toString('utf8'),{file}).diagrams[0];
  const native=await mermaid.mermaidAPI.getDiagramFromText(model.source);
  return{file,hash:hash(bytes),db:native.db};
}

function web(db) {
  const p={users:[80,72,184,68],auth:[952,72,252,68],cdn:[80,268,184,68],s3:[80,484,220,80],lb:[380,268,200,68],api:[652,268,200,68],cache:[968,250,220,68],db:[968,366,220,68],queue:[652,492,200,68],worker:[968,492,220,68]};
  const routes={entry:[[172,140],[172,268]],policy:[[1078,140],[1078,196],[752,196],[752,268]],forward:[[264,302],[380,302]],assets:[[172,336],[172,484]],dispatch:[[580,302],[652,302]],cached:[[852,284],[968,284]],query:[[804,336],[804,400],[968,400]],enqueue:[[704,336],[704,492]],execute:[[852,526],[968,526]]};
  const labels={entry:[204,208],policy:[916,180],assets:[222,412],cached:[910,268],query:[884,384],enqueue:[738,444]};
  let svg=zone('region',db.getSubGraphs().find(g=>g.id==='region').title,[40,184,1200,440])+zone('apiGroup',db.getSubGraphs().find(g=>g.id==='apiGroup').title,[348,216,544,164]);
  for(const edge of db.getEdges())svg+=pathEdge(edge.id,edge.start,edge.end,routes[edge.id],{dashed:edge.stroke==='dotted',tone:edge.id==='entry'?'link':'muted',label:edge.text,labelAt:labels[edge.id]});
  const tags={users:'INPUT',auth:'IDENTITY',cdn:'EDGE',s3:'ASSETS',lb:'ROUTING',api:'APPLICATION',cache:'CACHE',db:'PRIMARY',queue:'QUEUE',worker:'BACKGROUND'};
  for(const node of db.getVertices().values())if(p[node.id])svg+=box(node.id,node.text,p[node.id],{tag:tags[node.id],focal:node.id==='api',store:['s3','cache','db'].includes(node.id),external:['users','auth'].includes(node.id)});
  svg+=legend(660,[{name:'Focal application',focal:true},{name:'Store / state'},{name:'HTTP ingress',line:true,tone:'link'},{name:'Assets / enqueue',line:true,dashed:true}]);
  return{svg,height:720,counts:{nodes:10,edges:9,groups:2},title:'Web application · deployment & dependencies',intro:'从边缘入口进入应用服务，认证、存储与异步工作分别保留。十个组件、九条关系、区域与安全组均与现有版本一致。',notes:['主请求链横向对齐；只有离开主线的静态资源、数据库与异步工作需要转弯。','安全组只包围 Load Balancer 与 API Server，区域范围仍包含八个组件。','组件职责由标签、边框与分组表达，API Server 是唯一强调节点。']};
}

function agent(db) {
  const p={user:[64,112,168,56],chat:[320,112,168,56],final:[1008,112,192,56],planner:[320,264,168,56],router:[576,264,168,56],approval:[576,416,168,56],blocked:[800,416,168,56],retry:[1040,416,160,56],store:[64,568,168,56],trace:[344,568,168,56],tool:[576,568,168,56],external:[1008,568,192,56]};
  const routes={'user-chat':[[232,140],[320,140]],'chat-planner':[[404,168],[404,264]],'planner-router':[[488,292],[576,292]],'router-approval':[[660,320],[660,416]],'approval-tool':[[628,472],[628,568]],'approval-blocked':[[744,444],[800,444]],'blocked-retry':[[968,444],[1040,444]],'tool-external':[[744,596],[1008,596]],'external-final':[[1200,588],[1220,588],[1220,140],[1200,140]],'external-trace':[[1104,624],[1104,660],[428,660],[428,624]],'store-trace':[[232,596],[344,596]]};
  const labels={'chat-planner':[430,216],'router-approval':[700,368],'approval-tool':[664,520],'approval-blocked':[772,428],'external-final':[1188,340],'store-trace':[288,580]};
  let svg='';
  const groups=db.getBlocksFlat().filter(b=>['ui','agent','policy','evidence'].includes(b.id));
  for(const[i,g]of groups.entries())svg+=zone(g.id,plain(g.label).split(' · ')[0],[40,64+i*152,1200,i===3?160:120]);
  for(const edge of db.getEdges()){
    const key=edge.start+'-'+edge.end;
    svg+=pathEdge(edge.id,edge.start,edge.end,routes[key],{dashed:edge.pattern==='dotted',tone:key==='approval-tool'?'accent':'muted',label:edge.label,labelAt:labels[key]});
  }
  const tags={user:'INPUT',chat:'INTERFACE',final:'OUTPUT',planner:'PLANNING',router:'ROUTING',approval:'POLICY',blocked:'STOP',retry:'RECOVERY',store:'CONTEXT',trace:'EVIDENCE',tool:'EXECUTION',external:'SERVICE'};
  for(const node of db.getBlocksFlat())if(p[node.id])svg+=box(node.id,node.label,p[node.id],{tag:tags[node.id],focal:node.id==='approval',store:['store','trace'].includes(node.id),external:node.id==='user',subtitle:false});
  svg+=legend(708,[{name:'Approval decision',focal:true},{name:'Context / evidence'},{name:'Call / handoff',line:true},{name:'Policy / evidence',line:true,dashed:true}]);
  return{svg,height:768,counts:{nodes:12,edges:11,groups:4},title:'Agent runtime · layers & handoffs',intro:'四层保留十二个组件与十一条关系。输入、规划、授权、执行、返回和证据同时呈现，不使用步骤播放。',notes:['界面层接纳任务；规划层确定工作并路由能力；策略层区分获准执行与拒绝。','Approval Gate → Tool Call 是强调路径；Blocked → Retry Path 沿用原例终点，没有补造自动重试回边。','右侧单独留出结果返回通道，底部留出证据通道；Context Store 与执行结果分别进入 Trace Log。']};
}

function sequence(db) {
  const actors=[...db.getActors().values()],ids=[...db.getActors().keys()],xs=new Map(ids.map((id,i)=>[id,112+i*176]));
  const messages=db.getMessages(),native=messages.filter(m=>m.from&&m.to&&![db.LINETYPE.NOTE,db.LINETYPE.ACTIVE_START,db.LINETYPE.ACTIVE_END].includes(m.type));
  const row=index=>148+index*44;let svg='';
  for(const id of ids)svg+=`<line x1="${xs.get(id)}" y1="108" x2="${xs.get(id)}" y2="692" stroke="${color.rule}" stroke-dasharray="4 4"/>`;
  const active=new Map();let ordinal=0,activationCount=0;
  for(const m of messages){
    if(m.type===db.LINETYPE.ACTIVE_START)active.set(m.from,row(ordinal-1));
    else if(m.type===db.LINETYPE.ACTIVE_END){const start=active.get(m.from);if(start===undefined)throw new Error('Unmatched activation');svg+=`<rect data-activation="${m.from}" x="${xs.get(m.from)-4}" y="${start}" width="8" height="${row(ordinal-1)+8-start}" fill="${color.secondary}" stroke="${color.muted}" stroke-width="0.8"/>`;active.delete(m.from);activationCount++;}
    else if(native.includes(m))ordinal++;
  }
  if(active.size)throw new Error('Unclosed activation');
  for(const[index,m]of native.entries()){
    const y=row(index),from=xs.get(m.from),to=xs.get(m.to),open=[db.LINETYPE.SOLID_OPEN,db.LINETYPE.DOTTED_OPEN,db.LINETYPE.SOLID_POINT,db.LINETYPE.DOTTED_POINT].includes(m.type),returned=m.type===db.LINETYPE.DOTTED;
    const tone=index===10?'accent':index===1?'link':'muted';
    const x1=from+(from<to?6:-6),x2=to+(from<to?-6:6);
    svg+=pathEdge('message-'+(index+1),m.from,m.to,[[x1,y],[x2,y]],{tone,dashed:returned||open,open,label:m.message,labelAt:[(from+to)/2,y-(labelLines(m.message).length>1?24:16)]});
    svg+=`<circle cx="${x1}" cy="${y}" r="7" fill="${color.paper}" stroke="${color[tone]}" stroke-width="1"/>`+text(x1,y+3,index+1,{size:8,tone,anchor:'middle',mono:true});
  }
  for(const[id,actor]of db.getActors())for(const y of [40,692])svg+=box(`${id}-${y===40?'top':'bottom'}`,actor.description,[xs.get(id)-64,y,128,64],{tag:actor.type==='database'?'STORE':actor.type==='queue'?'EVENT':id==='Auth'?'IDENTITY':actor.type==='actor'?'INPUT':'SERVICE',focal:id==='API',store:actor.type==='database'||actor.type==='queue',external:actor.type==='actor'});
  svg+=legend(800,[{name:'API / primary response',focal:true},{name:'Request',line:true},{name:'Return · filled arrow',line:true,dashed:true},{name:'Async · open arrow',line:true,dashed:true}]);
  return{svg,height:860,counts:{nodes:7,edges:12,activations:activationCount,participantCopies:14},title:'Cache miss · request, return & async work',intro:'保留七个参与者、十二条消息与五段激活区间。顶部和底部同时显示对象，消息顺序及调用、返回、异步语义保持一致。',notes:['先验证 JWT，再访问缓存；Miss 后查询 Postgres，随后更新缓存并发出 Trace。','返回消息使用虚线与实心箭头；Set cache、Emit trace 使用虚线与开放箭头，表达单向异步交接。','七条生命线采用 faithful 完整对照；没有隐藏 Auth、缓存、主数据库或 Trace，也没有增加缓存命中分支。']};
}

function entities(db) {
  const entities=[...db.getEntities().values()],byNative=new Map(entities.map(e=>[e.id,e.label]));
  const p={customer:[64,72,288,144],order:[496,72,288,216],order_item:[928,72,288,192],payment:[64,408,288,192],inventory:[496,408,288,192],product:[928,408,288,216]};
  const routes={'order-customer':[[496,132],[352,132]],'payment-order':[[352,468],[424,468],[424,216],[496,216]],'order_item-order':[[928,132],[784,132]],'order_item-product':[[1072,264],[1072,408]],'inventory-product':[[784,468],[928,468]]};
  const labels={'order-customer':[424,116],'payment-order':[460,344],'order_item-order':[856,116],'order_item-product':[1106,336],'inventory-product':[856,452]};
  const cards={ONLY_ONE:'1',ZERO_OR_ONE:'0..1',ONE_OR_MORE:'1..*',ZERO_OR_MORE:'0..*'};
  const readableLabels={payment_order:'Payments',order_item_order:'Order items',order_item_product:'Product',inventory_product:'Inventory'};
  const labelRewrites=[];let svg='';
  for(const[rIndex,r]of db.getRelationships().entries()){
    const from=byNative.get(r.entityA),to=byNative.get(r.entityB),key=from+'-'+to,points=routes[key];
    const displayLabel=readableLabels[r.roleA]||r.roleA;
    if(displayLabel!==r.roleA)labelRewrites.push({source:r.roleA,display:displayLabel,from,to});
    svg+=pathEdge('relation-'+(rIndex+1),from,to,points,{arrow:false,dashed:r.relSpec.relType==='NON_IDENTIFYING',label:displayLabel,labelAt:labels[key]});
    const a=points[0],b=points.at(-1),start=points[1],end=points.at(-2);
    const cardinal=(point,next,value)=>{const horizontal=point[1]===next[1],x=point[0]+(horizontal?Math.sign(next[0]-point[0])*16:-16),y=point[1]+(horizontal?24:Math.sign(next[1]-point[1])*20);return text(x,y,value,{size:8,tone:'muted',mono:true,anchor:'middle'});};
    svg+=cardinal(a,start,cards[r.relSpec.cardB])+cardinal(b,end,cards[r.relSpec.cardA]);
  }
  let attributes=0;
  for(const entity of entities){
    const[x,y,w,h]=p[entity.label],focal=entity.label==='order';attributes+=entity.attributes.length;
    svg+=`<g data-node-id="${entity.label}">${rect(x,y,w,h,color.paper,focal?color.accent:color.muted,'data-role="bounds"')}<path d="M ${x} ${y+48} H ${x+w}" stroke="${color.rule}"/>${text(x+16,y+18,'ENTITY',{size:8,tone:focal?'accent':'soft',mono:true})}${text(x+16,y+36,entity.label,{size:14,weight:600})}`;
    for(const[i,a]of entity.attributes.entries()){
      const cy=y+64+i*24;
      svg+=`<g data-field="${entity.label}.${a.name}"><title>${escape(a.comment||a.name)}</title>${text(x+16,cy,a.name,{size:10,mono:true})}${text(x+156,cy,a.keys.join('/'),{size:8,tone:'soft',mono:true,anchor:'middle'})}${text(x+w-16,cy,a.type,{size:9,tone:'muted',mono:true,anchor:'end'})}</g>`;
    }svg+='</g>';
  }
  svg+=legend(660,[{name:'Order aggregate',focal:true},{name:'PK / FK / UK'},{name:'Identifying',line:true},{name:'Non-identifying',line:true,dashed:true}]);
  const references=entities.flatMap(e=>e.attributes.filter(a=>a.comment).map(a=>`${e.label}.${a.name}: ${a.comment}`));
  return{svg,height:720,counts:{nodes:6,edges:5,attributes},labelRewrites,title:'Orders · entities, keys & relationships',intro:'保留六张表、三十六个字段和五条关系。字段与 SQL 类型完整展示；基数、唯一键、外键引用与非识别关系继续保留。',notes:['order 连接 customer、order_item 与 payment；商品与库存位于另一侧。','payment 一侧是 0..*，与 order 的关系使用虚线；其他多端按源声明为 1..*，不擅自改成可选。','关系标签采用 Payments、Order items 等简洁表达；原始关系名与端点保留在来源记录中。','本图是实体级 ER 对照：线连接实体，未推断原例没有给出的 ON DELETE、索引或空值约束。'],references};
}

function page(slug, study) {
  const defs=['muted','accent','link'].map(tone=>`<marker id="arrow-${tone}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${color[tone]}"/></marker>`).join('')+`<marker id="arrow-open" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polyline points="0 0,8 3,0 6" fill="none" stroke="${color.muted}" stroke-width="1.2"/></marker>`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escape(study.title)} · Diagram Design study</title>${fontLink}
<style>*{box-sizing:border-box}body{margin:0;padding:32px;background:${color.paper};color:${color.ink};font-family:${fonts.sans}}.frame{max-width:1280px;margin:auto}nav{display:flex;gap:24px;font-size:13px;margin-bottom:32px}a{color:${color.link};text-underline-offset:4px}.eyebrow{font-family:${fonts.mono};font-size:10px;color:${color.muted};letter-spacing:.16em;text-transform:uppercase}h1{font-family:'Instrument Serif','Noto Serif TC',serif;font-weight:400;font-size:32px;margin:8px 0 12px}p{max-width:880px;line-height:1.8;font-size:14px}.diagram-container{width:calc(100% + 40px);margin-left:-20px;overflow-x:auto;margin-top:16px}svg{display:block;width:100%;min-width:1280px}.notes{border-top:1px solid ${color.rule};margin-top:24px;padding-top:20px}.notes h2{font-size:16px;font-weight:600}.notes li{font-size:14px;line-height:1.9;max-width:900px;margin-bottom:8px}.fidelity{font-family:${fonts.mono};font-size:12px;color:${color.muted}}.references{columns:2;font-family:${fonts.mono};font-size:11px;line-height:1.8;overflow-wrap:anywhere}footer{margin-top:32px;font-size:12px;color:${color.muted};line-height:1.8}@media(max-width:700px){body{padding:20px}h1{font-size:28px}nav{flex-wrap:wrap}.references{columns:1}}@media print{body{padding:0}nav{display:none}.diagram-container{overflow-x:visible;width:100%;margin-left:0}svg{min-width:0}}</style></head>
<body><main class="frame"><nav aria-label="对照导航"><a href="/compare/diagram-design.html">返回四组对照</a><a href="/compare/${slug}.html">打开交互版</a><a href="/reference/archify/${slug}.html">Archify 原版</a></nav><p class="eyebrow">Diagram Design · same-content layout study</p><h1>${escape(study.title)}</h1><p>${escape(study.intro)}</p><div class="diagram-container" tabindex="0" aria-label="图表横向滚动区域"><svg viewBox="0 0 1280 ${study.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${slug}-title ${slug}-desc"><title id="${slug}-title">${escape(study.title)}</title><desc id="${slug}-desc">${escape(study.intro)}</desc><defs>${defs}</defs><rect width="1280" height="${study.height}" fill="${color.paper}"/>${study.svg}</svg></div><section class="notes"><h2>中文阅读说明</h2><ul>${study.notes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul><p class="fidelity">${study.counts.nodes} nodes · ${study.counts.edges} relationships${study.counts.attributes?` · ${study.counts.attributes} fields`:''} · 0 removed</p>${study.references?`<h2>外键引用原文</h2><div class="references">${study.references.map(r=>`<div>${escape(r)}</div>`).join('')}</div>`:''}</section><footer>依据现有 Markdown 内容，按 Diagram Design 的默认设计规范重新编排。此页为固定坐标的静态 SVG 研究。交互页面读取同一份 Markdown，可切换定制、丰富与简洁风格，采用原生自动布局。<br>设计规范：cathrynlavery/diagram-design @ ${commit.slice(0,12)} · <a href="source.json">来源与保留数量</a> · <a href="LICENSE.txt">MIT license</a></footer></main></body></html>\n`;
}

const records=[];
for(const[slug,draw]of [['web-app',web],['tool-workflow',agent],['cache-miss',sequence],['orders-schema',entities]]){
  const input=await parse(slug),study=draw(input.db),html=page(slug,study);
  const output=new JSDOM(html).window.document,db=input.db;
  let sourceIds;
  if(db.getVertices){const groups=new Set(db.getSubGraphs().map(g=>g.id));sourceIds=[...db.getVertices().keys()].filter(id=>!groups.has(id));}
  else if(db.getBlocksFlat){const invisible=new Set(['space','edge','column-setting','classDef','applyClass','applyStyles','composite']);sourceIds=db.getBlocksFlat().filter(b=>b.id!=='root'&&!invisible.has(b.type)).map(b=>b.id);}
  else if(db.getActors)sourceIds=[...db.getActors().keys()];
  else sourceIds=[...db.getEntities().values()].map(e=>e.label);
  const outputIds=[...output.querySelectorAll('[data-node-id]')].map(e=>e.getAttribute('data-node-id').replace(/-(top|bottom)$/,''));
  if(new Set(outputIds).size!==sourceIds.length||sourceIds.some(id=>!outputIds.includes(id)))throw new Error(`${slug}: source nodes and drawn nodes differ`);
  const sourceEdges=db.getEdges?db.getEdges().length:db.getActors?db.getMessages().filter(m=>m.from&&m.to&&![db.LINETYPE.NOTE,db.LINETYPE.ACTIVE_START,db.LINETYPE.ACTIVE_END].includes(m.type)).length:db.getRelationships().length;
  if(output.querySelectorAll('[data-edge-id]').length!==sourceEdges)throw new Error(`${slug}: source relationships and drawn relationships differ`);
  if(slug==='orders-schema'&&output.querySelectorAll('[data-field]').length!==study.counts.attributes)throw new Error('ER fields were omitted');
  writeFileSync(join(target,slug+'.html'),html);
  records.push({file:slug+'.html',input:input.file,inputSha256:input.hash,sha256:hash(html),counts:study.counts,removed:[],merged:[],collapsed:[],labelRewrites:study.labelRewrites||[],layout:'Editorial SVG authored for this fixed example; Mermaid remains the input content.'});
}
copyFileSync(join(reference,'LICENSE'),join(target,'LICENSE.txt'));
const references=['skills/diagram-design/SKILL.md','skills/diagram-design/references/style-guide.md','skills/diagram-design/references/import-mermaid.md','skills/diagram-design/assets/template.html'].map(file=>({file,sha256:hash(readFileSync(join(reference,file)))}));
writeFileSync(join(target,'source.json'),JSON.stringify({repository:'https://github.com/cathrynlavery/diagram-design',commit,format:'Self-contained HTML with inline SVG; no Markdown renderer from diagram-design.',preset:'Default light / faithful / engineer / doc-wide, sequence and layers use fit height.',generator:'scripts/build-design-comparisons.mjs',extraction:'Official Mermaid extractor checked flowchart, sequence and ER. Native Mermaid parser preserves participant aliases, activations and block data. No rendered Mermaid coordinates used.',designSources:references,files:records},null,2)+'\n');
console.log(JSON.stringify({pages:records.length,commit,sourceCounts:records.map(r=>({file:r.file,...r.counts}))}));
