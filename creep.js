Creep.prototype.respawnLead = function() {
    if(this.memory.steps) {
        let nParts = this.nParts();
        let rate = Math.min(1,nParts.move/(this.body.length-(nParts.carry||0)-nParts.move));
        let tts = this.body.length*3;
        let adjustedSteps = this.memory.steps/rate;
        //console.log(rate,tts,adjustedSteps)
        return Math.ceil(tts+adjustedSteps);
    } else {
        return 0;
    }

};

Creep.prototype.nParts = function () {
	return _.countBy(this.body,p=>p.type);
};

Creep.prototype.work = function () {
    console.log(this.room, this, this.memory.role, this.respawnLead());
    if(!this.spawning) {
        this[this.memory.func].call(this);
    }
};

Creep.prototype.objID = function() {
	return this.memory.flag.slice(1);
};

Creep.prototype.state = function(newState) {
    if(newState) { 
        this.memory.state = newState;
    }
    return this.memory.state;
};

Creep.prototype.energyToFill = function() {
    return this.carryCapacity-this.carry.energy;
};

Creep.prototype.moveAndAct = function(target,action,amount=undefined) {
    let rc = this[action].call(this,target);
    //console.log(target,this,rc)
    if(rc==ERR_NOT_IN_RANGE || rc==ERR_NOT_ENOUGH_RESOURCES) {
        rc = this.moveTo(target,{ignoreCreeps:false,maxOps:2500*3});
        //console.log(this,rc)
    }
};

Creep.prototype.findClosest = function(targets) {
	if(!this._closest) {
		this._closest = {};
		let res = PathFinder.search(this.pos,_(targets).map().value(),{plainCost:2,swampCost:10,maxOps:2500*5});
		let pathToClosest = res.path;
		let targetPos = _.last(pathToClosest);
		this._closest.path = pathToClosest;
		this._closest.obj = _(targets).filter(s=>s.pos.x===targetPos.x && s.pos.y===targetPos.y && s.pos.room === targetPos.room).value()[0];	
	}
	return this._closest;
};

Creep.prototype.dropOffPoint = function(candidates) {
    if(this.memory.dropLocation===undefined) {
       
        let targets = _.filter(candidates,(target) => target instanceof Creep? true : target.energyToFill()>0);

        if(targets.length>0) {
            let target = this.findClosest(targets).obj;
            //console.log(target)
            if(target === null) {
                return;
            } else {
                this.memory.dropLocation=target.id;
            }
        }
    }
    return Game.getObjectById(this.memory.dropLocation);
};

Creep.prototype.pathCacheN = function() {
    const nCreepsInRoom = this.room.nCreeps();
    if(nCreepsInRoom===1) {
        return 200;
    } else if (nCreepsInRoom===2) {
        return 100;
    } else if (nCreepsInRoom===3) {
        return 40;
    } else {
        return 5;
    }
};

Creep.prototype.droppedAndEmpty= function(candidates) {
        let obj = this.dropOffPoint(candidates);
        //console.log(obj)
        if(obj===null || obj.energyToFill()===0) {
            this.memory.dropLocation = undefined;
            return;
        }
        if (this.pos.isNearTo(obj)) {
            this.transferEnergy(obj);
        } else {
            this.moveTo(obj,{ignoreCreeps:false,reusePath:this.pathCacheN()});
            return false;
        }
        if(this.carry.energy===0) {
            this.memory.dropLocation=undefined;
            return true;
        } 
        return false;
};

Creep.prototype.scout = function() {
	let flag = Game.flags[this.memory.flag];
	//console.log(this,flag.room);
	if(!flag.room) {
		let res = PathFinder.search(this.pos,flag,{plainCost:2,swampCost:10,maxOps:2500*5});
		this.moveTo(flag,{maxOps:3000});
		//this.moveByPath(res.path);
		Memory.temp = res.path;
		return;
	}
	this.moveAndAct(flag.room.controller,'reserveController');
};

Creep.prototype.defend = function() {
    let flag = Game.flags[this.memory.flag];
    console.log('mmmm',this,flag.room);
    if(this.room!==flag.room) {
        let res = PathFinder.search(this.pos,flag,{plainCost:2,swampCost:10,maxOps:2500*5});
        console.log(res);
        this.moveTo(flag,{maxOps:3000});
        //this.moveByPath(res.path);
        Memory.temp = res.path;
        return;
    }
    let target = this.room.find(FIND_HOSTILE_CREEPS)[0];
    if(target) {
        this.moveAndAct(target,'attack');
    } 
};

Creep.prototype.wreck = function() {
    let flag = Game.flags[this.memory.flag];
    //console.log(this,flag.room);
    if(!flag.room) {
        let res = PathFinder.search(this.pos,flag,{plainCost:2,swampCost:10,maxOps:3000});
        this.moveTo(flag,{maxOps:3000});
        Memory.temp = res.path;
        return;
    }
    let target = flag.pos.lookFor('structure')[0];
    //console.log(this,target);
    if(target) {
        this.moveAndAct(target,'dismantle');
    }
};


Creep.prototype.mine = function() {
    let link, storageLink, rc;
    let source = Game.getObjectById(this.objID()); 
    if(!Game.flags[this.memory.flag].hasVision()) {
    	this.moveTo(Game.flags[this.memory.flag],{maxOps:2500*3});
    	return;
    }
    //console.log(this.objID(),source);
    if(!this.memory.sourceLinkID && source) {
        link = source.pos.findClosestByRange(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_LINK}});
        if (link && link.pos.inRangeTo(source.pos,2)) {
            this.memory.sourceLinkID=link.id;
        }
    }
    if(!this.memory.storageLinkID && this.room.storage) {
        link = this.room.storage.pos.findClosestByRange(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_LINK}});
        if (link) {
            this.memory.storageLinkID=link.id;
        }
    }
    if(this.memory.sourceLinkID && this.memory.storageLinkID) {
        //Mine via Linky
        //console.log('link mining....',this)
        link = Game.getObjectById(this.memory.sourceLinkID);
        if(!this.pos.inRangeTo(link.pos,1)) {
            //console.log(this,link)
            this.moveTo(link);
            return;
        }
        if(!this.pos.inRangeTo(source.pos,1)) {
            this.moveTo(source);
            //console.log(this,link)
            return;
        }
        storageLink = Game.getObjectById(this.memory.storageLinkID);
        if(link.energyToFill()>=0 && this.carry.energy>0) {
            rc = this.transferEnergy(link,Math.min(link.energyToFill(),this.carry.energy));
        }    
        //console.log(this,link.cooldown,link.energy)
        if(link.cooldown===0 && link.energy>=500 ) {
            rc = link.transferEnergy(storageLink,Math.min(500,storageLink.energyToFill()));
        }
    }

    this.moveAndAct(source,'harvest');
    if(this.carry.energy>0 && !this.memory.sourceLinkID) {
        //If mining to carry not ground look for haulers to xfer to
        let haulers = _.filter(this.pos.findInRange(FIND_MY_CREEPS,1),(creep) => creep.memory.role==='hauler');
        let energyNearSelf = this.pos.findInRange(FIND_DROPPED_RESOURCES,1);
        if(haulers.length>0 && energyNearSelf.length===0) {
            rc = this.transferEnergy(haulers[0],Math.min(haulers[0].energyToFill(),this.carry.energy));
        }
    }
};

Creep.prototype.haul = function() {
    if(!this.state()) {
        this.state('pick');
    }
    let target;
    if(this.state()==='pick') {
        target = Game.getObjectById(this.objID());
        //console.log(target)
        let destination;
        let energyToPickup;
        if (target) {
	        let minersNearTarget = _.filter(target.pos.findInRange(FIND_MY_CREEPS,1),(creep) => creep.memory.role==='miner');
	        let energyNearTarget = target.pos.findInRange(FIND_DROPPED_RESOURCES,1);
	        let i = Math.floor(Math.random()*energyNearTarget.length)-1;
	        energyToPickup = energyNearTarget[i<0?0:i];
	        destination = minersNearTarget?minersNearTarget[0]:target;
	        //console.log(minersNearTarget,energyNearTarget,i,energyToPickup) 
	        if (energyToPickup) {
	            destination = energyToPickup;
	        }
        } else {
        	destination = Game.flags[this.memory.name];
        }        
        let rc;
        
        if(!this.pos.isNearTo(destination)) {
            rc = this.moveTo(destination);
        } else {
            rc = this.pickup(energyToPickup);
            //console.log(this,rc,energyToPickup,destination)
            if (this.carry.energy>=this.carryCapacity) {
                this.state('drop');
            }
        }
    } else if (this.state()==='drop') {
        let candidates;
        if(Game.rooms[this.memory.fromRoom].storage && Game.rooms[this.memory.fromRoom].roster().extensionManager) {
            candidates = [Game.rooms[this.memory.fromRoom].storage];
        } else {
        	//console.log(Game.rooms[this.memory.fromRoom].depots('drop'))
            candidates = Game.rooms[this.memory.fromRoom].depots('drop');
        }
        if(this.droppedAndEmpty(candidates)) {
            this.state('pick');
        }
    }   
};

Creep.prototype.upgrade = function() {
    let link, rc;
    if(!this.memory.controllerLinkID) {
        link = this.room.controller.pos.findClosestByRange(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_LINK}});
        if (link && link.pos.inRangeTo(this.room.controller.pos,2)) {
            this.memory.controllerLinkID=link.id;
        }
    }
    if(this.memory.controllerLinkID) {
        rc = this.refillFromLink(Game.getObjectById(this.memory.controllerLinkID));
    }
    this.moveAndAct(this.room.controller,'upgradeController');
};

Creep.prototype.refillFromLink = function(link) {
    let rc = 0;
    let energyToFill = this.energyToFill();
    if(energyToFill>0 && link.energy>=energyToFill) {
        rc = link.transferEnergy(this,energyToFill);
    }
    return rc;
};


Creep.prototype.refilledFromStorage =  function() {
        if(!this.pos.isNearTo(this.room.storage)) {
            this.moveTo(this.room.storage);
            return false;
        } else {
            let rc = this.room.storage.transfer(this,RESOURCE_ENERGY,Math.min(this.energyToFill(),this.room.storage.store.energy));
            if (this.carry.energy>=this.carryCapacity) {
                return true;
            }
        } 
};

Creep.prototype.refilled = function(depots) {
        let depot;
        if(this.room.storage && this.room.storage.store.energy>20000) {
            return this.refilledFromStorage();
        }
        if(this.memory.depot===undefined) {
            if(depots.length>0) {
                depot = this.pos.findClosestByPath(depots);
                if(!depot) {
                    return;
                }
                this.memory.depot = depot.id;
            } else {
                return;
            }
        } 
        depot = Game.getObjectById(this.memory.depot);
        if(depot===undefined || depot.energy===0) {
            this.memory.depot = undefined;
            return;
        }
        if (!this.pos.isNearTo(depot)) {
            this.moveTo(depot);
        } else {
            let depotEnergy = depot.structureType==STRUCTURE_STORAGE?depot.store.energy:depot.energy;
            let energyToFill = Math.min(this.energyToFill(),depotEnergy); 
            depot.transferEnergy(this,energyToFill);
        }
        if (this.carry.energy>=this.carryCapacity) {
            this.memory.depot=undefined;
            return true;
        }
        return false;
};


Creep.prototype.supply = function() {
    if(!this.state() || this.carry.energy===0) {
        this.state('pick');
    }
       
    if(this.state()=='drop') {
        if(this.room.roster().upgrader) {
            let target = _.filter(this.room.roster().upgrader,c=>c.energyToFill()>0)[0];
            if(target) {
                this.moveAndAct(target,'transferEnergy');
            }            
        }
    } else if (this.state()=='pick') {
        if(this.refilled(this.room.depots())) {
            this.state('drop');
        }
    }
};

Creep.prototype.constructionSite = function() {
    let candidates = this.room.find(FIND_MY_CONSTRUCTION_SITES);
    if(this.memory.siteID===undefined) {
        if(candidates.length>0) {
        	//console.log(candidates);
            let target = this.pos.findClosestByPath(candidates);
            //console.log(target)
            if(target===undefined || target===null) {
            	//this.suicide();
                return;
            } else {
                this.memory.siteID=target.id;
            }
        } else {
            this.memory.siteID = undefined;
            this.suicide();
            return;
        }
    }
    var target = Game.getObjectById(this.memory.siteID);
    if (target===null) {
        this.memory.siteID = undefined;
    }
    return target;
};


Creep.prototype.erect = function() {
    
    if(!this.state()) {
        this.state('pick');
    }
    if(this.state()==='pick') {
        if(this.refilled(this.room.depots())) {
            this.state('build');
        }
    } else if (this.state()=='build') {
        let site = this.constructionSite();
        if(site) {
            this.moveAndAct(site,'build');
        }
        if(this.carry.energy===0) {
            this.state('pick');
        }
    }
    
};

Creep.prototype.repairSite = function() {
    //let candidates = _.filter(this.room.find(FIND_MY_STRUCTURES),s => s.structureType!==STRUCTURE_RAMPART && s.hits<s.hitsMax);
    let candidates = [];
    let roads = _.filter(this.room.find(FIND_STRUCTURES),s => s.structureType===STRUCTURE_ROAD && s.hits<s.repairTarget());
    let walls = _.filter(this.room.find(FIND_STRUCTURES),s => s.structureType===STRUCTURE_WALL && s.hits<s.repairTarget());
    let ramparts = _.filter(this.room.find(FIND_MY_STRUCTURES),s => s.structureType===STRUCTURE_RAMPART && s.hits<s.repairTarget());
    let hitTarget = 0;
    if (roads.length>0) {
        this.say('Road');
        candidates = roads;
    } else if(ramparts.length>0) {
        this.say('Rampart');
        candidates = ramparts;
    } else if (walls.length > 0) {
        this.say('Wall');
        candidates = walls;
    }
    if(this.memory.siteID===undefined) {
        if(candidates.length>0) {
            let target = this.pos.findClosestByPath(candidates);
            console.log(this,target)
            if(target===undefined || target===null) {
                this.memory.siteID = undefined;
                return;
            } else {
                this.memory.siteID=target.id;
            }
        } else {
            this.memory.siteID = undefined;
        }
    }
    var target = Game.getObjectById(this.memory.siteID);
    if(target) {
        console.log(this,target,target.hits,target.repairTarget());
        if (target===null || target.hits >= target.repairTarget()*1.1) {
            this.memory.siteID = undefined;
            return null;
        }
        return target;
    } else {
        return null;
    }
};
Creep.prototype.tend = function() {
    
    if(!this.state()) {
        this.state('pick');
    }
    if(this.state()==='pick') {
        if(this.refilled(this.room.depots())) {
            this.state('build');
            this.memory.siteID = undefined;
        }
    } else if (this.state()=='build') {
        let site = this.repairSite();
        if(site) {
            this.moveAndAct(site,'repair');
        }
        if(this.carry.energy===0) {
            this.state('pick');
        }
    }    
};

Creep.prototype.manageExtensions = function() {
    if(!this.state()) {
        this.state('pick');
    }
    if(this.state()==='pick') {
        if(this.refilledFromStorage()) {
            this.state('drop');
        }
    } else if (this.state()=='drop') {
        var candidates = this.room.find(FIND_MY_STRUCTURES,{'filter': function(s) {return s.structureType===STRUCTURE_TOWER || s.structureType===STRUCTURE_SPAWN || s.structureType===STRUCTURE_EXTENSION;}});
        if(this.droppedAndEmpty(candidates)) {
            this.state('pick');
        }
    }
};

Creep.prototype.renew = function() {
    if(this.memory.renewing || (this.ticksToLive<250 && !Game.getObjectById(this.memory.spawnID).spawning)) {
        this.memory.renewing = true;
        Game.getObjectById(this.memory.spawnID).renewCreep(this);
        if (this.ticksToLive>1000) {
            this.memory.renewing=false;
        }
    }     
};

Creep.prototype.atFlag = function(flag) {
    if(!_.isEqual(this.pos,Game.flags[this.room.name+'SM'].pos)) {
         this.moveTo(Game.flags[this.room.name+'SM'].pos);
         return false;
    }
    return true;
};

Creep.prototype.manageStorage = function() {
    if(!this.atFlag(this.room.name+'SM')) {
        return;
    }
    if(!this.memory.spawnID) {
        this.memory.spawnID=this.pos.findInRange(FIND_MY_SPAWNS,1)[0].id;
    }
    this.renew();
    if(!this.memory.linkID) {
        let link = this.pos.findInRange(FIND_MY_STRUCTURES,1,{filter:{structureType:STRUCTURE_LINK}});
        if (link.length>0) {
            this.memory.linkID=link[0].id;
        }
    }
    if(!this.memory.controllerLinkID) {
        let link = this.room.controller.pos.findInRange(FIND_MY_STRUCTURES,2,{filter:{structureType:STRUCTURE_LINK}});
        if (link.length>0) {
            this.memory.controllerLinkID=link[0].id;
        }
    }    

    let link = Game.getObjectById(this.memory.linkID);
    let controllerLink = Game.getObjectById(this.memory.controllerLinkID);
    let controllerLinkNeedsEnergy = controllerLink&&controllerLink.energy<100+500*0.97;
    //console.log('SM    ',link.cooldown,link.energy,this.carry.energy,controllerLinkNeedsEnergy,this.energyToFill(),this.room.storage.energyToFill()>this.energyToFill())
    if(link) {
        if(link.cooldown>5 || !controllerLinkNeedsEnergy) {
            if(link.energy>0) {
                link.transferEnergy(this,Math.min(this.energyToFill(),link.energy));
            }
            if (this.carry.energy>0) {
                let rc = this.transferEnergy(this.room.storage,this.carry.energy);
                //console.log(this,rc)
            }
        } else if(controllerLinkNeedsEnergy) { 
            if(this.energyToFill()>0 && this.room.storage.energyToFill()>this.energyToFill()) {
                this.room.storage.transfer(this,RESOURCE_ENERGY,this.energyToFill());
                //return;
            }
            if(link.energy>500) {
                link.transferEnergy(controllerLink);
            } else {
                this.transferEnergy(link,Math.min(this.carry.energy,link.energyToFill()));
            }
        }
    }

};