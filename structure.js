Structure.prototype.energyToFill = function() {
	if(!this.energyCapacity && !this.store) {
		return 0;
	}
	if(this.structureType===STRUCTURE_STORAGE) {
		return this.storeCapacity-this.store.energy;
	}
	return this.energyCapacity-this.energy;
};

Structure.prototype.hasEnergy = function() {
	if(!this.energyCapacity && !this.store) {
		return false;
	}
	if(this.structureType===STRUCTURE_STORAGE) {
		return this.store.energy>0;
	}
	return this.energy>0;
};

Structure.prototype.work = function() {
	if(this.structureType===STRUCTURE_TOWER) {
		let enemy = this.room.find(FIND_HOSTILE_CREEPS);
		if(enemy.length>0) {
			this.attack(enemy[0]);
		}
		if(false && this.room.storage.store.energy>990000) {
			let walls = _.filter(this.room.find(FIND_STRUCTURES),s => s.structureType===STRUCTURE_WALL);
			let target = _.sortBy(walls,w=>w.hists)[0];
			this.repair(target);
		}
	}

};

Structure.prototype.repairTarget = function() {
	switch(this.structureType) {
		case STRUCTURE_ROAD:
			return 3000;
		case STRUCTURE_RAMPART:
			return this.room.storage.store.energy>800000?6000000:2000000;
		case STRUCTURE_WALL:
			return 15000000;
		default:
			return 0;
	}
};