import assert from "node:assert/strict";
import test from "node:test";
import { collectionActionAllowed } from "./workflowPermissions.js";

test("collection decisions and recovery require explicit collection authority in addition to API admin authentication", () => {
  for (const action of ["review", "execute"]) {
    assert.equal(collectionActionAllowed(["admin"], "POST", "/workspace/collection-notes/" + action, { roles: ["collections_reviewer"] }), false);
    assert.equal(collectionActionAllowed(["admin", "collections_reviewer"], "POST", "/workspace/collection-notes/" + action, {}), true);
  }
  assert.equal(collectionActionAllowed(["admin"], "POST", "/workspace/write-recovery/approve", { family: "collection_note" }), false);
  assert.equal(collectionActionAllowed(["admin", "collections_reviewer"], "POST", "/workspace/write-recovery/approve", { family: "collection_note" }), true);
  assert.equal(collectionActionAllowed(["admin"], "POST", "/workspace/collection-notes/prepare", {}), true);
  assert.equal(collectionActionAllowed(["admin"], "POST", "/workspace/collection-notes/reconcile", {}), true);
});

test("scheduling decisions require the separate scheduling reviewer role",()=>{
 for(const path of ["/workspace/linked-schedule-creations/review","/workspace/linked-schedule-creations/execute","/workspace/write-recovery/approve"]){assert.equal(collectionActionAllowed(["admin"],"POST",path,{family:"linked_schedule_create"}),false);assert.equal(collectionActionAllowed(["admin","scheduling_reviewer"],"POST",path,{family:"linked_schedule_create"}),true);}
});
