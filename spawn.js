Spawn.prototype.work = function() {
	//console.log(this.room.name)
    if(this.room._spawned) {
        return;
    }
	let next = this.room.Q().peek();
	let rc;
	if(next) {
		console.log(this.room,next.opt.role);
		rc = this.createCreep(next.body,next.opt);
		if(_.isString(rc)) {
			Game.flags[next.opt.flag].spawned(next.opt.role);
			this.room.Q().pop();
			Memory.rooms[this.room.name].spawnQueue = this.room.Q().data;
            this.room._spawned = true;
		}
	}
};

Spawn.prototype.energyToFill = function() {
    return this.energyCapacity-this.energy;
};

Spawn.prototype.hasEnergy = function() {
	return this.energy>10;
};

Spawn.prototype.energyCostOf = function(parts) {
    const costs = {};
    costs[MOVE] = 50;
    costs[CARRY]= 50;
    costs[WORK] =100;
    costs[ATTACK] = 80;
    costs[RANGED_ATTACK] = 150;
    costs[HEAL] = 250;
    costs[TOUGH] = 10;
    costs[CLAIM] = 600;

    let cost = 0;
    _.forEach(parts,part => {
        cost += costs[part];
    });
    return cost;
};

Spawn.prototype.scout = function() {
	let body = [CLAIM,CLAIM,MOVE,MOVE];
	return {'body': body, opt: {role:'scout',func:'scout'}};
};

Spawn.prototype.wrecker = function() {
    let body = [MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK];
    return {'body': body, opt: {role:'wrecker',func:'wreck'}};
};

Spawn.prototype.miner = function(energy,remote=false) {
	let body = [MOVE,CARRY,WORK,WORK];
	let done = false;
	while (this.energyCostOf(body) <= energy && !done) {
        let nParts = _.countBy(body,p=>p);
        if(nParts.work<6) {
            if(remote) {
                body.push(MOVE);
            }
            body.push(WORK);

        } else if (!remote && nParts.carry < 1) {
            body.push(CARRY);
        } else if (remote && nParts.carry <12) {
            body.push(MOVE);
            body.push(CARRY);
        } else {
            done=true;
    	}
	}
	while (this.energyCostOf(body) > energy) {
        body.pop();
    }	
	return {'body': body, opt: {role:'miner',func:'mine'}};
};

Spawn.prototype.hauler = function(energy) {
	let body = [MOVE,CARRY];
	let done = false;
    while (this.energyCostOf(body) <= energy && !done) {
        let nParts = _.countBy(body,p=>p);
        if (nParts.carry < 14) {
            body.push(MOVE);	        	
            body.push(CARRY);            
        } else {
            done=true;
        }
    }
    while (this.energyCostOf(body) > energy) {
        body.pop();
        body.pop();
    }	
   	return {'body': body, opt: {role:'hauler', func:'haul'}};
};

Spawn.prototype.upgrader = function() {
    let body = [WORK,WORK,MOVE,CARRY];
    let done = false;
    let workParts = 0;
    let maxWork =22;
    if (this.room.storage) {
    	maxWork = this.room.storage.store.energy>30000?22:15;    
    }
    if (this.room.controller.progressTotal===undefined && this.room.controller.progress ===0) {
        maxWork = 15;
    }
    while (this.energyCostOf(body) <= Math.max(300,this.room.energyCapacityAvailable-100) && !done) {
        let nParts = _.countBy(body,p=>p);
        let link = this.room.controller.pos.findClosestByRange(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_LINK}});
        if (link && link.pos.inRangeTo(this.room.controller.pos,2)) {
            workParts = maxWork;
        } else {
            workParts = Math.ceil(maxWork/this.room.openSpotsNear(this.room.controller));
        }
        if(nParts.work<workParts) {
            body.push(WORK);
        } else if (nParts.carry < 2) {
            body.push(CARRY);
            body.push(MOVE);
        } else if (nParts.move < maxWork) {
            body.push(MOVE);
        } else {
            done = true;
        }
    }
    while (this.energyCostOf(body) > Math.max(300,this.room.energyCapacityAvailable-100)) {
        body.pop();
    }
	return {'body': body, opt: {role:'upgrader', func:'upgrade'}};
};    

Spawn.prototype.supplier = function() {
    let body = [MOVE,CARRY];
    let done = false;
    while (this.energyCostOf(body) <= Math.max(300,this.room.energyCapacityAvailable-100) && !done) {
        let nParts = _.countBy(body,p=>p);
        if (nParts.carry < 8) {
            body.push(MOVE);
            body.push(CARRY);
        } else {
            done = true;
        }
    }
    while (this.energyCostOf(body) > Math.max(300,this.room.energyCapacityAvailable-100)) {
        body.pop();
        body.pop();
    } 
	return {'body': body, opt: {role:'supplier', func:'supply'}};
};

Spawn.prototype.builder = function()  {
    let body = [WORK,WORK,MOVE,CARRY];
    let done = false;
    while (this.energyCostOf(body) <= Math.max(300,this.room.energyCapacityAvailable-100) && !done) {
        let nParts = _.countBy(body,p=>p);
        if(nParts.carry<4) {
        	body.push(CARRY);
            body.push(MOVE);
        } else if(nParts.work<5) {
            body.push(WORK);
            body.push(MOVE);
        } else if (nParts.carry < 8) {
            body.push(CARRY);
            body.push(MOVE);
        } else {
            done=true;
        }
    }
    while (this.energyCostOf(body) > Math.max(300,this.room.energyCapacityAvailable-100)) {
        body.pop();
    }
	return {'body': body, opt: {role:'builder', func:'erect'}};
};

Spawn.prototype.medic = function()  {
    let body = [WORK,WORK,MOVE,CARRY];
    let done = false;
    while (this.energyCostOf(body) <= Math.max(300,this.room.energyCapacityAvailable-100) && !done) {
        let nParts = _.countBy(body,p=>p);
        if(nParts.carry<4) {
        	body.push(CARRY);
            body.push(MOVE);
        } else if (nParts.work<5) {
            body.push(WORK);
            body.push(MOVE);
        } else if (nParts.carry < 8) {
            body.push(CARRY);
            body.push(MOVE);
        } else {
            done=true;
        }
    }
    while (this.energyCostOf(body) > Math.max(300,this.room.energyCapacityAvailable-100)) {
        body.pop();
    }
	return {'body': body, opt: {role:'medic', func:'tend'}};
};


Spawn.prototype.extensionManager = function()  {
    if(!this.room.storage) {
        return null;
    }
    let body = [MOVE,CARRY];
    let done = false;
    while (this.energyCostOf(body) <= Math.max(300,this.room.energyCapacityAvailable-100) && !done) {
        let nParts = _.countBy(body,p=>p);
        if (nParts.carry < 16) {
            body.push(MOVE);            
            body.push(CARRY);            
        } else {
            done = true;
        }
    }
    while (this.energyCostOf(body) > Math.max(300,this.room.energyCapacityAvailable-100)) {
        body.pop();
    }
    return {'body': body, opt: {role:'extensionManager', func:'manageExtensions'}};
}; 

Spawn.prototype.storageManager = function(energy)  {
    let body = [MOVE,CARRY];
    let done = false;
    while (this.energyCostOf(body) <= energy && !done) {
        let nParts = _.countBy(body,p=>p);
        if (nParts.carry < 10) {            
            body.push(CARRY);            
        } else {
            done = true;
        }
    }
    while (this.energyCostOf(body) > energy) {
        body.pop();
    }
	return {'body': body, opt: {role:'storageManager', func:'manageStorage'}};
};   

Spawn.prototype.defender = function()  {
    let body = [TOUGH,TOUGH,MOVE,MOVE,HEAL,ATTACK];
    let done = false;
    while (this.energyCostOf(body) <= Math.max(300,this.room.energyCapacityAvailable-100) && !done) {
        let nParts = _.countBy(body,p=>p);
        if(nParts.heal<2) {
            body.push(HEAL);
            body.push(MOVE);
        } else if (nParts.attack<5) {
            body.push(ATTACK);
            body.push(MOVE);
        } else if (nParts.tough < 5) {
            body.push(TOUGH);
            body.push(MOVE);
        } else {
            done=true;
        }
    }
    while (this.energyCostOf(body) > Math.max(300,this.room.energyCapacityAvailable-100)) {
        body.pop();
    }
    return {'body': body, opt: {role:'defender', func:'defend'}};
};