
var h = {enumerable:false, writable:false};
var H = function (call) {h.value = call; return h;}
var d = Object.defineProperty;

var Map = require ('./Map').Map;


(function(){
//:
//:
    /**
    Returns a type string identifying the native type identifier for a provided object.
    @name getTypeStr
    @function
    @param obj The object in need of type identification.
    */
    var typeGetter = ({}).toString;
    var getTypeStr = module.exports["getTypeStr"] = function (obj) {
        var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
        return tstr;
    };
    
    
    /**
    Compare this Javascript object for deep equality with another. Properties 
        answering to "object", "nodelist" or "array" on {@link getTypeStr} 
        are recursed and their properties tested for equality, and so on. 
        Every other property must have the same {@link getTypeStr} and be 
        equal-equal, except Functions, Nodes and Elements which must be 
        triple-equal.
    @name Object#compare
    @function
    @param other The other thing to compare <code>this</code> to.
    @param {Boolean} subsetOK Turns off the subset check, saving a little 
        bit of time if it's not needed.
    @returns {Boolean|Integer} Returns nonzero if <code>other</code> is 
        equal to or contains <code>this</code>. Precisely, returns Boolean 
        true for equality and Integer -1 for subset.
    */
    d (Object.prototype, 'compare', H (function (other, subsetOK) {
        if (this === other) return true;
        var thisType = getTypeStr (this);
        var otherType = getTypeStr(other);
        
        if (thisType != otherType) return false;
        if (this == other) return true;
        
        if (thisType == 'nodelist') {
            for (var i=0,j=this.length; i<j; i++)
                if (this[i] !== other[i])
                    return false;
            if (subsetOK) return true;
            if (this.length == other.length)
                return true;
            return -1;
        }
        
        if (
            thisType != 'object' && 
            thisType != 'array' && 
            thisType != 'map'
        ) 
            return false;
        
        var isSubset = false;
        // we're definitely some sort of iterable type that needs recursed
        for (var key in this) {
            if (!other.hasOwnProperty(key)) return false;
            var subResult = 
                this[key] === other[key] || 
                this[key].compare(other[key]);
            if (!subResult)
                return false;
            if (subResult === -1)
                isSubset = true;
        }
        if (subsetOK) return true;
        if (isSubset || Object.keys(this).length < Object.keys(other).length)
            return -1;
        return true;
    }));
    
    
    /**
    Append enumerable properties from the provided object onto ourselves. 
        Properties on keys starting with the character in {@link MERGE_KEY} 
        will be merged instead of overwritten.
    @name Object#extend
    @function
    @param {Object} def A source object.
    @returns {Object} self.
    */
    /**
    A character prefix used to indicate keys that should be merged during 
        {@link Object#extend} operations. Setting any value that fails a 
        nonzero test disables the feature entirely.
    @name MERGE_KEY
    @type String
    */
    module.exports["MERGE_KEY"] = '$';
    d (Object.prototype, "extend", H (function (def) {
        // this is wet but saves pointlessly checking MERGE_KEY every iter
        if (module.exports.MERGE_KEY)
            for (var key in def)
                if (key[0] == module.exports.MERGE_KEY)
                    this[key] = this[key].merge (def[key])
                else
                    this[key] = def[key];
        else
            for (var key in def)
                this[key] = def[key];
        var rest = restore [getTypeStr (this)];
        if (rest)
            return rest(this);
        return this;
    }));
    
    
    /**
    As part of a merge schema - indicates that a key is to be shallow 
        copied into the merge target.
    @name $COPY
    @constant
    */
    var $COPY = module.exports["$COPY"] = 9220;
    
    
    /**
    As part of a merge schema - indicates that children of a key are to 
        be overwritten instead of merged, as {@link Object#extend} does 
        it. Behaves identically inside either a {@link MergeBlacklist} or 
        {@link MergeWhitelist}.
    @name $EXTEND
    @constant
    */
    var $EXTEND = module.exports["$EXTEND"] = 9221;
    
    
    /**
    As part of a {@link MergeWhitelist} - indicates that a key is to be 
        merged as normal.
    @name $MERGE
    @constant
    */
    var $MERGE = module.exports["$MERGE"] = 9222;
    
    
    /**
    Create a new Whitelist schema for merging two objects. Only keys present 
        in the list will be merged.
    @name MergeWhitelist
    @private
    @class
    @constructs
    @param {Object} schema Keys mapped to further rules. Optional.
    */
    var MergeWhitelist = module.exports["MergeWhitelist"] = function () {
        Map.apply (this, arguments);
        this.type = "white";
    };
    var dummy = function(){}; 
    dummy.prototype = Map.prototype;
    MergeWhitelist.prototype = new dummy();
    
    
    /**
    Create a new {@link MergeWhitelist} schema definition.
    @name $Whitelist
    @function
    @param {Object} schema Keys mapped to further rules. Optional.
    */
    var $Whitelist = module.exports["$Whitelist"] = function (schema) {
        return new MergeWhitelist (schema);
    };
    
    /**
    Create a new Blacklist schema for merging two objects. For clean syntax
        in your schema definitions, you should usually use the 
        {@link $Blacklist} factory Function.
    @name MergeBlacklist
    @private
    @class A Blacklist schema definition for refining {@link Object#merge}. 
        Keys not found in the list will be merged. A {@link MergeArray} 
        instance works as if it were found in a {@link MergeWhitelist}.
    @constructs
    @param {Object} schema Keys mapped to further rules. Optional.
    */
    var MergeBlacklist = module.exports["MergeBlacklist"] = function () {
        Map.apply (this, arguments);
        this.type = "black";
    };
    var dummy = function(){}; 
    dummy.prototype = Map.prototype;
    MergeBlacklist.prototype = new dummy();
    
    
    /**
    Create a new {@link MergeBlacklist} schema definition.
    @name $Blacklist
    @function
    @param {Object} schema Keys mapped to further rules. Optional.
    */
    var $Blacklist = module.exports["$Blacklist"] = function (schema) {
        return new MergeBlacklist (schema);
    };
    
    
    /**
    Create a new Array schema for merging two Arrays.
    @name MergeArray
    @private
    @class Defines a "smart" Array - all contents will be expected to be 
        of Object type and contain a unique key on the property provided 
        by the ID parameter. The merge process will drop Objects with 
        duplicate IDs and will fill the result set in order by default or 
        optionally defined comparison on ID. Finally, each Object may be 
        filtered by further schema rules.
    @constructs
    @param {Object} schema Keys mapped to further rules. Optional.
    */
    var MergeArray = module.exports["MergeArray"] = function (ID, rules, sort) {
        this.ID = ID;
        this.rules = rules;
        this.sort = sort;
        this.type = "array";
    };
    
    
    /**
    Create a new {@link MergeArray} schema definition.
    @name $Array
    @function
    @param {Object} schema Keys mapped to further rules. Optional.
    */
    var $Array = module.exports["$Array"] = function (ID, rules, sort) {
        return new MergeArray (ID, rules, sort);
    };
    

    /**
    Clobber enumerable properties on <code>this</code> with those found on 
        <code>def</code>, stepping recursively into each Object value to 
        perform a deep extension. i.e. ({a:{a:0,b:9}}).merge({a:{b:1}}) 
        produces {a:{a:0,b:1}}. The specific Object instances in the 
        result prefer those currently within <code>this</code>. Arrays 
        found within our tree are concatenated. If an Array is found in 
        <code>def</code> but a non-Array is found in <code>this</code>, an 
        Error is thrown. Finally, a schema object may be provided to 
        refine the merge procedure by selecting keys to extend, merge or 
        ignore, as well as enabling a more complete approach to Arrays of 
        data-containing Objects.
    @name Object#merge
    @function
    @param {Object} def A source object.
    @param {MergeWhitelist|MergeBlacklist} schema A set of detailed rules 
        for merging <code>this</code> with <code>def</code>.
    @returns {Object} self.
    */
    d (Object.prototype, "merge", H (function (def, schema) {
        if (getTypeStr (this) != 'object') return def;
        
        if (schema == $EXTEND) {
            for (var key in def)
                this[key] = def[key];
            return this;
        }
        
        if (!schema || schema == $MERGE) {
            for (var key in def)
                if (this[key]) 
                    this[key] = this[key].merge (def[key]);
                else 
                    this[key] = def[key];
            return this;
        }
        switch (schema.type) {
            case 'white':
                for (var key in def) {
                    var scheme = schema.get(key);
                    if (!scheme) continue;
                    
                    if (this[key] === undefined) {
                        this[key] = def[key];
                        continue;
                    }
                    
                    if (scheme === $COPY || !this[key])
                        this[key] = def[key];
                    else
                        this[key] = this[key].merge (def[key], scheme)
                }
                break;
            case 'black':
                for (var key in def) {
                    var scheme = schema.get(key);
                    
                    if (!scheme) {
                        if (this[key])
                            this[key] = this[key].merge (def[key]);
                        else
                            this[key] = def[key];
                        continue;
                    }
                    
                    if (scheme === $EXTEND) {
                        if (this[key])
                            this[key] = this[key].merge (def[key], $EXTEND);
                        else
                            this[key] = def[key];
                        this[key] = def[key];
                        continue;
                    }
                    
                    if (scheme === $MERGE) {
                        this[key] = this[key].merge(def[key]);
                        continue;
                    }
                    
                    if (scheme.type) {
                        this[key] = this[key].merge(def[key], scheme);
                        continue;
                    }
                    // all other values indicate that the key should not be merged
                }
                break;
            case 'array':
                throw new Error ('schema defines Array, found Object in target');
                break;
            default:
                throw new Error ('encountered anomalous schema definition');
        }
        
        return this;
    }));

    /**
    Append contents of an Array to this one. Overrides Object.merge and does not 
        call it. If a schema definition is provided, all Array elements are 
        expected to be of Object type. A provided ID property is used to provide 
        canonical identity to each element and a further schema definition 
        allows merging duplicate elements in the input. If no further schema 
        is provided, duplicate elements are simply dropped.
    @name Array#merge
    @function
    @param {Array} def A source array.
    @returns {Obect} self.
    */
    d (Array.prototype, "merge", H (function (def, schema) {
        if (!schema || schema == $MERGE) {
            for (var i=0,j=def.length; i<j; i++) this.push(def[i]);
            return this;
        }
        var uniqueReg = new Map();
        for (var i=0,j=this.length; i<j; i++)
            uniqueReg.set(this[i][schema.ID], i);
        var targetI;
        for (var i=0,j=def.length; i<j; i++)
            if ((targetI=uniqueReg.get (def[i][schema.ID])) === undefined)
                this.push (def[i]);
            else
                if (schema.rules)
                    if (schema.rules === $EXTEND)
                        this[targetI] = def[i];
                    else if (schema.rules === $MERGE)
                        this[targetI] = this[targetI].merge(def[i]);
                    else
                        this[targetI] = this[targetI].merge(def[i], schema.rules);
                    
        if (schema.sort === undefined) return;
        if (schema.sort)
            this.sort (function (a,b) {
                return (schema.sort(a[schema.ID],b[schema.ID]));
            });
        else
            this.sort (function (a,b) {
                return a[schema.ID] < b[schema.ID] ? -1 : 1;
            });
        return this;
    }));
    
    d (Number.prototype, "merge", H (function (def) { return def; }));
    d (String.prototype, "merge", H (function (def) { return def; }));
    
    
    
    var restore = {
        boolean:        Boolean,
        number:         Number,
        string:         String
    };
    /**
    Returns a JSON-duplicate of <code>this</code>, or self if this is a native object.
    @name Object#clone
    @function
    @returns {Object} A clone of <code>this</code>.
    */
    d (Object.prototype, "clone", H (function () {
        if (Object.keys(this).length) {
            var newObj = {};
            for (var key in this) {
                newObj[key] = this[key].clone();
            }
            return newObj;
        }
        
        var rc = restore[getTypeStr(this)];
        if (rc) return rc(this);
        return this;
    }));
    
    // these are odd - if you return <code>this</code> you get a heap object instead of a native
    // so instead we create a new native
    d (Number.prototype, "clone", H (function () { return Number(this); }));
    d (String.prototype, "clone", H (function () { return String(this); }));

    /**
    Returns a JSON-duplicate of <code>this</code>.
    @name Array#clone
    @function
    @returns {Object} A clone of <code>this</code>.
    */
    d (Array.prototype, "clone", H (function () {
        var newArr = [];
        for (var i=0,j=this.length; i<j; i++) newArr.push (this[i].clone());
        return newArr;
    }));
    
    
    /**
    Execute a callback once for each property on <code>this</code>. The 
        callback receives each value, each key and <code>this</code> as 
        parameters, and is applied either to <code>this</code> or 
        <code>thisarg</code>.
    @name Object#forEach
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Object} self.
    */
    d (Object.prototype, "forEach", H (function (call, thisarg) {
        for (var key in this)
            call.call (thisarg||this, this[key], key, this);
        return this;
    }));
    
    
    /**
    Execute a callback once for each property on <code>this</code>. The 
        callback receives each value, each key and <code>this</code> as 
        parameters, and is applied either to <code>this</code> or 
        <code>thisarg</code>. If every iteration of <code>call</code> 
        returns a nonzero value, Boolean true is returned. Otherwise, 
        Boolean false is returned.
    @name Object#forEvery
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Boolean} true if every iteration of <code>call</code> 
        returned a nonzero value.
    */
    d (Object.prototype, "forEvery", H (function (call, thisarg) {
        for (var key in this)
            if (!call.call (thisarg||this, this[key], key, this))
                return false;
        return true;
    }));
    /**
    Better name for Array's existing <code>every</code> method.
    @name Array#forEvery
    @function
    */
    d (Array.prototype, "forEvery", H (Array.prototype.every));
    
    
    /**
    Execute a callback once for each property on <code>this</code>. The 
        callback receives each value, each key and <code>this</code> as 
        parameters, and is applied either to <code>this</code> or 
        <code>thisarg</code>. If any single iteration of <code>call</code> 
        returns a nonzero value, Boolean true is returned. Otherwise, 
        Boolean false is returned.
    @name Object#forSome
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Boolean} true if any single iteration of <code>call</code> 
        returned a nonzero value.
    */
    d (Object.prototype, "forSome", H (function (call, thisarg) {
        for (var key in this)
            if (call.call (thisarg||this, this[key], key, this))
                return true;
        return false;
    }));
    /**
    Better name for Array's existing <code>some</code> method.
    @name Array#forSome
    @function
    */
    d (Array.prototype, "forSome", H (Array.prototype.some));
    
    
    /**
    Create a new Object by Executing a callback once for each property on 
        <code>this</code> and including every property for which the 
        callback returned a nonzero value. The callback receives each 
        value, each key and <code>this</code> as parameters, and is 
        applied either to <code>this</code> or <code>thisarg</code>.
    @name Object#filter
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Object} A shallow copy of <code>this</code> with rejected 
        properties omitted.
    */
    d (Object.prototype, "filter", H (function (call, thisarg) {
        var newObj = {};
        for (var key in this)
            if (call.call (thisarg||this, this[key], key, this))
                newObj[key] = this[key];
        return newObj;
    }));
    
    // Map and Reduce removed. Object#reduce interferes with jsbn
//:
//:
})();
