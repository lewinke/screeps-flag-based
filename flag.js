Flag.prototype.manage = function() {
	let self=this;
	let associated = _(Game.creeps).filter(c=>c.memory.flag===self.name).groupBy(c=>c.memory.role).mapValues(list=>_.map(list,c=>c.id)).value();
	this.memory.associated = associated;

	let type = this.name[0];
	//console.log(this);
	switch(type) {
		case 'H':  //Harverster/hauler
			return this.source();
		case 'C':  //Controller/supplier
			return this.controller();
		case 'M': //Misc
			return this.misc();
		case 'S': //Storage/Extension Managerss
			return this.storage();	
		case 'R': 
			if(!Memory.flags[this.name]) {
				Memory.flags[this.name] =  {
					'associated': {
						'builder': [],
						'medic':[]
					},
					'queued': {}
				};
			}
			if(!Memory.flags[this.name].queued) {
				Memory.flags[this.name].queued = {};
			}
			return this.scout();
		case 'X': 
			if(!Memory.flags[this.name]) {
				Memory.flags[this.name] =  {
					'associated': {
						'wrecker': []
					},
					'queued': {}
				};
			}
			if(!Memory.flags[this.name].queued) {
				Memory.flags[this.name].queued = {};
			}
			return this.destroy();


	}
};

Flag.prototype.hasVision = function() {
	if(this.room) {
		return true;
	}
	return false;
};

Flag.prototype.closestSpawn = function() {
	if(!this._closestSpawn) {
		this._closestSpawn = {};
		let res = PathFinder.search(this.pos,_(Game.spawns).map().value(),{plainCost:2,swampCost:10,maxOps:2500*5});
		Memory.test = res;
		let pathToClosest = res.path;
		let spawnPos = _.last(pathToClosest);
		this._closestSpawn.path = pathToClosest;
		this._closestSpawn.spawn = _(Game.spawns).filter(s=>s.pos.x===spawnPos.x && s.pos.y===spawnPos.y && s.pos.room === spawnPos.room).value()[0];	
	}
	return this._closestSpawn;
};

Flag.prototype.scout = function() {
	_.forEach(this.objects('scout'),function(c) {console.log(c,c.memory.role,c.room,c.ticksToLive,c.respawnLead(),c.ticksToLive-c.respawnLead());});
	//console.log(_.filter(this.objects('scout'),c=>c.spawning || c.ticksToLive>c.respawnLead()).length);
	//let s = this.objects('scout');
	let s =_.filter(this.objects('scout'),c=>c.spawning || c.ticksToLive>c.respawnLead());
	if(s.length<1 && !this.isQueued('scout')) {
		let closest = this.closestSpawn().spawn;
		let priority = 3;
		let newScout = closest.scout();
		let steps = this.closestSpawn().path.length;
		Object.assign(newScout,{opt: Object.assign(newScout.opt,{'flag':this.name,'fromRoom':closest.room.name,'steps': steps, 'priority':priority})});
		closest.room.Q().push(newScout);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('scout');
	}
	if(this.room) {
		let enemies = this.room.find(FIND_HOSTILE_CREEPS);
		console.log('xxxxxxxxxxxxxx',enemies,enemies.length,s.le);
		let d = this.objects('defender');
		if(enemies.length>0 && d.length<1 && !this.isQueued('defender')) {
			let closest = this.closestSpawn().spawn;
			let priority = 20;
			let newDefender = closest.defender();
			let steps = this.closestSpawn().path.length;
			Object.assign(newDefender,{opt: Object.assign(newDefender.opt,{'flag':this.name,'fromRoom':closest.room.name,'steps': steps, 'priority':priority})});
			closest.room.Q().push(newDefender);
			Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
			this.queued('defender');
		}
	}
};

Flag.prototype.destroy = function() {
	let s = this.objects('wrecker');
	console.log(s.length,this.isQueued('wrecker'));
	if(s.length<1 && !this.isQueued('wrecker')) {
		let closest = this.closestSpawn().spawn;
		console.log(closest)
		let priority = 3;
		let newWrecker = closest.wrecker();
		Object.assign(newWrecker,{opt: Object.assign(newWrecker.opt,{'flag':this.name,'fromRoom':closest.room.name,'priority':priority})});
		closest.room.Q().push(newWrecker);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('wrecker');
	}
};


Flag.prototype.source = function() {
	_.forEach(this.objects('miner'),function(c) {console.log(c,c.memory.role,c.room,c.ticksToLive,c.respawnLead(),c.ticksToLive-c.respawnLead());});	
	let m =_.filter(this.objects('miner'),c=>c.spawning || c.ticksToLive>c.respawnLead());
	let works = m.length===0?0:_.reduce(m,function(acc,c) {return acc+c.nParts().work;},0);
	if (works<5 && !this.isQueued('miner')) {
		let closest = this.closestSpawn().spawn;
		if(!Memory.roads[this.id]) {
			Memory.roads[this.id]=_.difference(_.map(this.closestSpawn().path,p=>'x'+p.x+'y'+p.y+'r'+p.roomName),Game._roads);
		}
		let priority = m.length===0?16:14;
		let energy = m.length===0?Math.max(300,closest.room.energyAvailable):Math.max(300,closest.room.energyCapacityAvailable-100);
		let remote = this.pos.roomName!==closest.room.name;
		let steps = this.closestSpawn().path.length;
		//console.log('remote  ',this.pos.roomName!==closest.room.name)
		let newMiner =closest.miner(energy,remote);
		Object.assign(newMiner,{opt: Object.assign(newMiner.opt,{'flag':this.name,'fromRoom':closest.room.name,'steps': steps, 'priority':priority})});
		closest.room.Q().push(newMiner);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('miner');
	}
	let link;
	//console.log(this,this.hasVision())
	if(this.hasVision()) {
		link = this.pos.findClosestByRange(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_LINK}});
	}
	if (!link || !link.pos.inRangeTo(this.pos,2)) {
		let h = this.objects('hauler');
		let closest = this.closestSpawn().spawn;
		let priority = h.length===0?15:14;
		let energy = h.length===0?Math.max(300,closest.room.energyAvailable):Math.max(300,closest.room.energyCapacityAvailable-100);		
		let newHauler =closest.hauler(energy);
		let steps = this.closestSpawn().path.length;		
		Object.assign(newHauler,{opt: Object.assign(newHauler.opt,{'flag':this.name,'fromRoom':closest.room.name,'steps': steps, 'priority':priority})});
		let carrys = _.countBy(newHauler.body,p=>p).carry;
		//console.log(newHauler.body,carrys,steps,Math.ceil((10*(2*steps))/(50*carrys)));
		if(h.length<Math.ceil((10*(2*steps))/(50*carrys)) && !this.isQueued('hauler')) {
			closest.room.Q().push(newHauler);
			Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
			this.queued('hauler');
		}
	}
}; 

Flag.prototype.controller = function() {
	//let u = this.objects('upgrader');
	_.forEach(this.objects('upgrader'),function(c) {console.log(c,c.memory.role,c.room,c.ticksToLive,c.respawnLead(),c.ticksToLive-c.respawnLead());});
	let u =  _.filter(this.objects('upgrader'),c=>c.spawning || c.ticksToLive>c.respawnLead());
	let works = u.length===0?0:_.reduce(u,function(acc,c) {return acc+c.nParts().work;},0);
	if(works<16 && !this.isQueued('upgrader') && u.length<1) {
		let closest = this.closestSpawn().spawn;
		let priority = 10;
		let newUpgrader = closest.upgrader();
		let steps = this.closestSpawn().path.length;
		Object.assign(newUpgrader,{opt: Object.assign(newUpgrader.opt,{'flag':this.name,'fromRoom':closest.room.name,'steps': steps, 'priority':priority})});
		closest.room.Q().push(newUpgrader);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('upgrader');
	}
	let link = this.pos.findClosestByRange(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_LINK}});
	//console.log(!link)
	if (!link || !link.pos.inRangeTo(this.pos,2)) {
		if(this.room.roster().upgrader) {
			let s = this.objects('supplier');
			let closest = this.closestSpawn().spawn;
			let priority = 9;
			let newSupplier =closest.supplier();
			let steps = this.closestSpawn().path.length;			
			Object.assign(newSupplier,{opt: Object.assign(newSupplier.opt,{'flag':this.name,'fromRoom':closest.room.name,'steps':steps, 'priority':priority})});
			let works = u.length===0?0:_.reduce(u,function(acc,c) {return acc+c.nParts().work;},0);
			let carrys = _.countBy(u[0].body,p=>p.type).carry;
			//console.log(s.length,works,steps,carrys)
			if(s.length<1+Math.ceil((works*steps)/(50*carrys))  && !this.isQueued('supplier')) {
				closest.room.Q().push(newSupplier);
				Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
				this.queued('supplier');
			}
		}
	}
};

Flag.prototype.storage = function() {
	let u = this.objects('extensionManager');
	if(!this.isQueued('extensionManager') && u.length<1) {
		let closest = this.closestSpawn().spawn;
		let priority = 18;
		let newEM = closest.extensionManager();
		Object.assign(newEM,{opt: Object.assign(newEM.opt,{'flag':this.name,'fromRoom':closest.room.name,'priority':priority})});
		closest.room.Q().push(newEM);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('extensionManager');
	}
	u = this.objects('storageManager');
	if(!this.isQueued('storageManager') && u.length<1 && Game.flags[this.room.name+'SM']) {
		let closest = this.closestSpawn().spawn;
		let priority = 10;
		let newSM = closest.storageManager(Math.max(300,closest.room.energyAvailable));
		Object.assign(newSM,{opt: Object.assign(newSM.opt,{'flag':this.name,'fromRoom':closest.room.name,'priority':priority})});
		closest.room.Q().push(newSM);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('storageManager');
	}


};

Flag.prototype.misc = function() {
	let b = (this.objects('builder')||[]);
	if(b.length<1  && !this.isQueued('builder') && this.room.structures().site.length>0) {
		let closest = this.closestSpawn().spawn;
		let priority = 5;
		let newBuilder = closest.builder();
		Object.assign(newBuilder,{opt: Object.assign(newBuilder.opt,{'flag':this.name,'fromRoom':closest.room.name,'priority':priority})});
		closest.room.Q().push(newBuilder);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('builder');
	}
	let t = (this.objects('medic')||[]);
	let l = this.room.storage.store.energy>800000?3:1;
	if(t.length<l && !this.isQueued('medic')) {
		let closest = this.closestSpawn().spawn;
		let priority = 4;
		let newMedic = closest.medic();
		Object.assign(newMedic,{opt: Object.assign(newMedic.opt,{'flag':this.name,'fromRoom':closest.room.name,'priority':priority})});
		closest.room.Q().push(newMedic);
		Memory.rooms[closest.room.name].spawnQueue = closest.room.Q().data;
		this.queued('medic');
	}
};

Flag.prototype.isQueued = function(role) {
	return this.memory.queued[role];
};

Flag.prototype.queued = function(role) {
	this.memory.queued[role]=true;
};

Flag.prototype.spawned = function(role) {
	console.log(this,role,'marked as spawned');
	this.memory.queued[role]=false;
};

Flag.prototype.objects = function(role) {
	if(!this.memory.associated[role]) {
		return [];
	}
	return _.map(this.memory.associated[role],id=>Game.getObjectById(id));
};