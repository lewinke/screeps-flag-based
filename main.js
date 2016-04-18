require('./room');
require('./flag');
require('./creep');
require('./structure');
require('./spawn');
var profiler = require('./screeps-profiler');
profiler.enable();
PathFinder.use(true);
module.exports.loop = function () {
	//return;
	//_.forEach(_.filter(Game.structures,s=>s.strutureType!==STRUCTURE_SPAWN),s=>s.destroy())

	//_.forEach(Game.creeps,function(c) {if(!c.memory.role) {c.suicide();}});
	//for(var mem in Memory) {delete Memory[mem];}
	//return; 
	//Memory.flags['R11S1'] = undefined;
	//Memory.flags.S11S1 = undefined;
	//return;
	if(!Memory.flags) {
		Memory.flags = {};
	}
	if(!Memory.roads) {
		Memory.roads = {};
	}
	Game._roads = [];
	Game._nSites = 0;
	console.log('======== Tick:',Game.time,Game.cpu.getUsed().toFixed(2));
	profiler.wrap(function() {	                      
        //Clear memory of dead creepss
		for(var i in Memory.creeps) {
			if(!Game.creeps[i]) {
				delete Memory.creeps[i];
			}
		} 

		_.forEach(Game.rooms,r=>r.init());
		_.forEach(Game.creeps,c=>c.work());
		_.forEach(Game.structures,s=>s.work());
		_.forEach(Game.flags,f=>f.manage());
		_.forEach(Game.spawns,s=>s.work());
		Game._roadsQ = _(Memory.roads).map().flatten().uniq().value();
		//_.forEach(Game._roadsQ.slice(0,100-Game._nSites),function(r) {
		//	const [d,x,y,room] = r.split(/x|y|r/);
		// 	let rc = Game.rooms[room].createConstructionSite(x*1,y*1,STRUCTURE_ROAD);
		//	console.log(rc)
		//});
		
		console.log('CPU',Game.cpu.getUsed().toFixed(2));
		console.log('CPU Info',Game.cpu.limit,Game.cpu.tickLimit,Game.cpu.bucket);
		Memory.stats = Game.time+","+Game.cpu.getUsed().toFixed(2); 
	});
	if (Memory.profiler && Memory.dumpIt) {
		_.forOwn(Memory.profiler.map,function(v,k) {console.log(k+','+v.time+','+v.calls+',');});
	}
};