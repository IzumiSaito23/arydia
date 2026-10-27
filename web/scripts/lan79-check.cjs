const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={URL};vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').resolve(__dirname,'../dist/campaign-model.js'),'utf8'),context);const valid=context.CampaignModel.lanMapUrl;
for(const address of ['http://192.168.1.3:1234','http://10.0.2.2:65535/','http://172.31.4.2:1/','http://localhost:18079/'])assert.equal(valid(address),address.replace(/\/$/,'')+'/');
for(const address of ['https://192.168.1.3:12/','http://example.com:1234/','http://8.8.8.8:12/','javascript:alert(1)','http://192.168.1.3:0/','http://192.168.1.3:65536/','http://192.168.999.3:12/','http://192.168.1.3:12/?code=123456','http://user@192.168.1.3:12/','http://172.32.0.1:123/'])assert.throws(()=>valid(address),address);
console.log('PASS: LAN join entry accepts only explicit private HTTP room addresses; public, script and credential URLs rejected.');
