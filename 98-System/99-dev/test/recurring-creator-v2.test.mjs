import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const load = name => fs.readFileSync(path.join(root, name), "utf8");
const creatorSource = load("98-System/01-script/create_recurring_task.js");

function mockCreate(frequencyMode, values) {
  const prompts = [...(values.prompts ?? [])];
  const choices = [...(values.choices ?? [])];
  const written = [];
  const notices = [];
  const files = new Map();

  globalThis.app = {
    metadataCache:{getFileCache: () => ({frontmatter:{}})},
    vault:{
      getMarkdownFiles: () => [],
      getAbstractFileByPath: filename => {
        if(files.has(filename))return files.get(filename);
        if(fs.existsSync(path.join(root,filename))) {
          return {path:filename,extension:path.extname(filename).slice(1),basename:path.basename(filename)};
        }
        if(filename==="02-Task/Recurring")return {path:filename};
        return null;
      },
      read:async file => load(file.path),
      createFolder:async filename => {files.set(filename,{path:filename});},
      create:async(filename,body) => {
        written.push({filename,body});
        const file={path:filename,extension:"md",basename:path.basename(filename,".md")};
        files.set(filename,file);
        return file;
      }
    },
    workspace:{getLeaf:()=>({openFile:async()=>{}})}
  };
  globalThis.window={moment:(value)=>({
    format:()=>"2026-10-27",
    isValid:()=>typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  })};
  globalThis.Notice=class {constructor(value){notices.push(value);}};
  const tp={system:{
    prompt:async()=>prompts.shift() ?? null,
    suggester:async()=>choices.shift() ?? null
  }};
  const module={exports:{}};
  new Function("module","exports",creatorSource)(module,module.exports);
  return {run:async()=>module.exports(tp),written,notices};
}

async function isolate(testBody) {
  const old={app:globalThis.app,window:globalThis.window,Notice:globalThis.Notice};
  try{return await testBody();}
  finally {
    for(const key of Object.keys(old)) {
      if(old[key]===undefined)delete globalThis[key]; else globalThis[key]=old[key];
    }
  }
}

test("creator writes ISO multi-day weekly metadata and includes the note-local editor",async()=>{
  await isolate(async()=>{
    const fake=mockCreate("weekly",{
      prompts:["Clean workspace","2026-10-27","1","1,3,5","7"],
      choices:["weekly","none",{none:true}]
    });
    await fake.run();
    assert.equal(fake.written.length,1);
    const content=fake.written[0].body;
    assert.match(content,/^frequency: weekly$/m);
    assert.match(content,/^anchor: 2026-10-27$/m);
    assert.match(content,/^weekdays: \[1, 3, 5\]$/m);
    assert.match(content,/^lookahead_days: 7$/m);
    assert.match(content,/dataviewjs/);
    assert.match(content,/recurring_tasks/);
  });
});

test("creator produces monthly last Friday and never adds weekly list to monthly",async()=>{
  await isolate(async()=>{
    const fake=mockCreate("monthly",{
      prompts:["Monthly accounting","2026-10-27","2","90"],
      choices:["monthly","week","last",5,"none",{none:true}]
    });
    await fake.run();
    assert.equal(fake.written.length,1);
    const content=fake.written[0].body;
    assert.match(content,/^frequency: monthly$/m);
    assert.match(content,/^interval: 2$/m);
    assert.match(content,/^month_week: last$/m);
    assert.match(content,/^month_weekday: 5$/m);
    assert.doesNotMatch(content,/^weekdays:/m);
  });
});

test("creator cancellation and duplicate weekday specification have no Vault write",async()=>{
  await isolate(async()=>{
    const fake=mockCreate("weekly",{
      prompts:["Bad task","2026-10-27","1","1,1"],
      choices:["weekly"]
    });
    await fake.run();
    assert.equal(fake.written.length,0);
    assert.match(fake.notices[0],/重複/);
  });
});

test("creator still permits legacy anchor-day weekly definition by leaving input blank",async()=>{
  await isolate(async()=>{
    const fake=mockCreate("weekly",{
      prompts:["Legacy days","2026-10-27","1","","7"],
      choices:["weekly","none",{none:true}]
    });
    await fake.run();
    assert.equal(fake.written.length,1);
    assert.doesNotMatch(fake.written[0].body,/^weekdays:/m);
  });
});
