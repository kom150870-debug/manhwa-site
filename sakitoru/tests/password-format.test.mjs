import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import {passwordHash,verifyPassword} from '../worker/auth.mjs';
test('versioned password hashes accept correct credentials and preserve legacy verification',async()=>{
 const password='Local-test-only-password',salt='local-test-salt-32-characters-long';
 const hash=await passwordHash(password,salt);
 assert.ok(hash.startsWith('scrypt$16384$8$5$'));
 assert.equal(await verifyPassword(password,salt,hash),true);
 assert.equal(await verifyPassword('wrong-password',salt,hash),false);
 assert.notEqual(await passwordHash(password,salt+'different'),hash);
 const legacy=pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');
 assert.equal(await verifyPassword(password,salt,legacy),true);
 assert.equal(await verifyPassword(password,salt,'invalid-format'),false);
});
