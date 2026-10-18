import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
export function database(filename=':memory:'){
 const db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys=ON');
 if(!db.prepare("SELECT name FROM sqlite_master WHERE name='users'").get())db.exec(readFileSync(new URL('../drizzle/0000_initial.sql',import.meta.url),'utf8'));
 return {raw:db,prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};
}
export function bucket(dir){mkdirSync(dir,{recursive:true});return {async put(key,data){const file=dir+'/'+key;mkdirSync(file.slice(0,file.lastIndexOf('/')),{recursive:true});writeFileSync(file,Buffer.from(data));},async get(key){if(!/^[a-zA-Z0-9/.-]+$/.test(key)||key.includes('..')||!existsSync(dir+'/'+key))return null;return {body:readFileSync(dir+'/'+key)};}};}
