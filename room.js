var HeapQueue = require('./heapQueue');
function cmp(a,b) {
		//console.log(a.opt.priority,b.opt.priority);
		return b.opt.priority - a.opt.priority;
}

let originalFindExitTo = Room.prototype.findExitTo;
Room.prototype.findExitTo = function(room) {
    console.log('XXXXX ',this.name,room);
    if(!Memory.exitDirs) {
        Memory.exitDirs = {};
    }
    if(!Memory.exitDirs[this.name]) {
        Memory.exitDirs[this.name]={};
    }
    if(!Memory.exitDirs[this.name][room]) {
        Memory.exitDirs[this.name][room] = originalFindExitTo.call(this,room);
    }
    return Memory.exitDirs[this.name][room];
};


Room.prototype.init = function() {
    console.log(this,this.energyAvailable,this.energyCapacityAvailable);
    if(this.controller) {
        console.log(this.controller.progressTotal,this.controller.progress);
    }
	let self = this;
	let hasScoutFlag = _(Game.flags).filter(f=>f.name[0]==='R').size()>0;
    Game._roads = Game._roads.concat(_.map(this.structures().road,function(r) {return 'x'+r.pos.x+'y'+r.pos.y+'r'+self.name;}));
    Game._roads = Game._roads.concat(_.map(_.filter(this.structures().site,s=>s.structureType===STRUCTURE_ROAD),function(r) {return 'x'+r.pos.x+'y'+r.pos.y+'r'+self.name;}));
    console.log('asdfsdaf ', this.structures().site.length);
    Game._nSites += this.structures().site.length;
    //_.forEach(this.structures().site,s=>s.remove());
	if(!Memory.rooms) {
        Memory.rooms = {};
    }

    if (!(hasScoutFlag || (this.controller && this.controller.my))) {
    	return;
    }

    _.forEach(this.sources(),function(s) {
    	let name = 'H'+s.id;
        //console.log(self.name,name,Memory.flags[name]);
    	if(!Memory.flags[name]) {
    		self.createFlag(s.pos,name);
    		Memory.flags[name]= {
    				'associated': {
    					'miner':[],
    					'hauler':[]
    				},
    				'queued': {}
    		};
    	}
    });

    if(!this.controller || !this.controller.my) {
    	return;
    }

    if(!Memory.rooms[this.name]) {
		Memory.rooms[this.name] = {
			spawnQueue:[],
			spots: {}
		};
    }
    if(Memory.rooms[this.name].autoGenRoads) {
        this.autoGenRoads();
    }

    if(this.controller) {
	    let name = 'C'+this.controller.id;
	    if(!Memory.flags[name]) {
	    	self.createFlag(this.controller.pos,name);
	    	Memory.flags[name] = {
	    		'associated': {
	    			'upgrader': [],
	    			'supplier': []
	    		},
	    		'queued': {}
	    	};
	    }
	}
	if(this.storage) {
	    let name = 'S'+this.controller.id;
	    if(!Memory.flags[name]) {
	    	self.createFlag(this.storage.pos,name);
	    	Memory.flags[name] = {
	    		'associated': {
	    			'extensionManager': [],
	    			'storageManager': []
	    		},
	    		'queued': {}
	    	};
	    }
	}
	if(!Memory.flags['M'+this.name]) {
		let pos = this.sources()[0].pos;
		self.createFlag(pos,'M'+this.name);
		Memory.flags['M'+this.name] = {
			'associated': {
				'builder': [],
				'medic':[]
			},
			'queued': {}
		};
	}
    this._spawnQueue = new HeapQueue(cmp);
    _.forEach(Memory.rooms[this.name].spawnQueue,function(item) {
    	self._spawnQueue.push(item);
    });
    this._spawned = false;
};

Room.prototype.Q = function() {
	return this._spawnQueue;
};

Room.prototype.structures = function () {
	if(!this._structures) {
			this._structures = _(this.find(FIND_MY_STRUCTURES)).groupBy(function(structure) {return structure.structureType;}).value();
			this._structures.road =this.find(FIND_STRUCTURES,{filter:{'structureType':STRUCTURE_ROAD}});
			this._structures.wall =this.find(FIND_STRUCTURES,{filter:{'structureType':STRUCTURE_WALL}});
			this._structures.site =this.find(FIND_MY_CONSTRUCTION_SITES);
	}
	return this._structures;
};

Room.prototype.sources = function() {
	if(!this._sources) {
		this._sources = this.find(FIND_SOURCES);
	}
	return this._sources;
};

Room.prototype.depots = function(need) {
    let fnc = need=='drop'?o=>o.energyToFill()>0:o=>o.hasEnergy();
    let structures = this.find(FIND_MY_STRUCTURES,{'filter':fnc}); 
    return _.filter(structures,s=>s.structureType!==STRUCTURE_TOWER&&s.structureType!==STRUCTURE_STORAGE); 
};

Room.prototype.openSpotsNear = function(obj) {
    if(!Memory.rooms[this.name].spots[obj.id]) {
        let pp = obj.pos;
        let res = this.lookAtArea(pp.y-1,pp.x-1,pp.y+1,pp.x+1);
        var t =  _(res)
            .map(function(r) {return _.map(r);})
            .flatten().flatten()
            .filter(function(t) {return t.type=='terrain' && (t.terrain=='plain' || t.terrain=='swamp');})
            .size();    
        Memory.rooms[this.name].spots[obj.id] = t;
    }
    return Memory.rooms[this.name].spots[obj.id];
};

Room.prototype.roster = function () {
    if(!this._roster || true) {
        let self = this;
        this._nCreeps = _(Game.creeps).filter(function(creep) {return creep.room==self;}).size();
        this._roster = _(Game.creeps).filter(function(creep) {return creep.room==self;}).groupBy(c=> c.memory.role).value();
        //this._roster2 = _(Memory.creeps).filter(function(creep) {return creep.assignedRoom==self.name;}).groupBy(c=> c.role).value();
        //Memory._roster2 = this._roster2;
    }
    return this._roster;
};

Room.prototype.nCreeps = function() {
    if(!this._roster) {
        this.roster();
    }
    return this._nCreeps;
};

Room.prototype.autoGenRoads = function() {
    let sources = this.find(FIND_SOURCES);
    let spawns = this.find(FIND_MY_SPAWNS);
    let self = this;
    _.forEach(spawns,function(spawn) {
        let toControllerPath = spawn.pos.findPathTo(self.controller,{ignoreCreeps:true});
        let toSourcePaths = _.map(sources,function(source) {
            return spawn.pos.findPathTo(source,{ignoreCreeps:true});
        });
        _.forEach(toControllerPath,function(seg) {
            self.createConstructionSite(seg.x,seg.y,STRUCTURE_ROAD);
        });
        //console.log(toSourcePaths);
        _.forEach(toSourcePaths,function(path) {
            _.forEach(path,function(seg) {
              self.createConstructionSite(seg.x,seg.y,STRUCTURE_ROAD);  
          });             
        });
    });
    Memory.rooms[this.name].autoGenRoads = undefined;
};
