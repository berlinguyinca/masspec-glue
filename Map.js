
var h = {enumerable:false, writable:false};
var H = function (call) {h.value = call; return h;}
var d = Object.defineProperty;
(function(){
//:
//:
    /**
    Creates a new empty Map.
    @name Map
    @class Safe map type that permits the use of absolutely any key string 
        without risk of namespace collisions.
    @constructor
    */
    var Map = module.exports["Map"] = function(init){
        if (init)
            for (var key in init)
                this['*'+key] = init[key];
    };
    var mp = Map.prototype;
    
    
    /**
    Fetches a value for a provided key.
    @name Map#get
    @function
    @param {String} key The desired key.
    @returns The mapped value, or `undefined`.
    */
    d (mp, 'get', H (function (key) {
        return this['*'+key];
    }));
    
    
    /**
    Sets a value for a key.
    @name Map#set
    @function
    @param {String} key The desired key.
    @param value A value to map to `key`.
    @returns The value set.
    */
    d (mp, 'set', H (function (key, value) {
        return this['*'+key] = value;
    }));
    
    
    /**
    Erases a value for a key.
    @name Map#erase
    @function
    @param {String} key The key to erase.
    @returns The value set for this key prior to erasure, or `undefined`.
    */
    d (mp, 'erase', H (function (key) {
        var val=this['*'+key];
        delete this['*'+key]; 
        return val;
    }));
    
    
    /**
    Produces a list of keys with assigned values.
    @name Map#keys
    @function
    @returns {Array.<string>} An Array of keys with values assigned on this 
        Map.
    */
    d (mp, 'keys', H (function () {
        var out = [];
        for (var key in this)
            out.push (key.slice(1));
        return out;
    }));
    
    
    /**
    Execute a callback once for each property on <code>this</code>. The 
        callback receives each value, each key and <code>this</code> as 
        parameters, and is applied either to <code>this</code> or 
        <code>thisarg</code>.
    @name Map#forEach
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Map} self.
    */
    d (mp, "forEach", H (function (call, thisarg) {
        for (var key in this)
            call.call (thisarg||this, this[key], key.slice(1), this);
        return this;
    }));
    
    
    /**
    Execute a callback once for each property on <code>this</code>. The 
        callback receives each value, each key and <code>this</code> as 
        parameters, and is applied either to <code>this</code> or 
        <code>thisarg</code>. If every iteration of <code>call</code> 
        returns a nonzero value, Boolean true is returned. Otherwise, 
        Boolean false is returned.
    @name Map#forEvery
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Boolean} true if every iteration of <code>call</code> 
        returned a nonzero value.
    */
    d (mp, "forEvery", H (function (call, thisarg) {
        for (var key in this)
            if (!call.call (thisarg||this, this[key], key.slice(1), this))
                return false;
        return true;
    }));
    
    
    /**
    Execute a callback once for each property on <code>this</code>. The 
        callback receives each value, each key and <code>this</code> as 
        parameters, and is applied either to <code>this</code> or 
        <code>thisarg</code>. If any single iteration of <code>call</code> 
        returns a nonzero value, Boolean true is returned. Otherwise, 
        Boolean false is returned.
    @name Map#forSome
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Boolean} true if any single iteration of <code>call</code> 
        returned a nonzero value.
    */
    d (mp, "forSome", H (function (call, thisarg) {
        for (var key in this)
            if (call.call (thisarg||this, this[key], key.slice(1), this))
                return true;
        return false;
    }));
    
    
    /**
    Create a new Map by Executing a callback once for each property on 
        <code>this</code> and including every property for which the 
        callback returned a nonzero value. The callback receives each 
        value, each key and <code>this</code> as parameters, and is 
        applied either to <code>this</code> or <code>thisarg</code>.
    @name Map#filter
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Map} A shallow copy of <code>this</code> with rejected 
        properties omitted.
    */
    d (mp, "filter", H (function (call, thisarg) {
        var newObj = new Map();
        for (var key in this)
            if (call.call (thisarg||this, this[key], key.slice(1), this))
                newObj[key] = this[key];
        return newObj;
    }));
    
    
    /**
    Create a new Map by Executing a callback once for each property on 
        <code>this</code> and including every value returned by the 
        callback instead of the original properties. The callback receives 
        each value, each key and <code>this</code> as parameters, and is 
        applied either to <code>this</code> or <code>thisarg</code>.
    @name Map#map
    @function
    @param {Function} call The call to execute for each property.
    @param thisarg Any entity to which <code>call</code> should be applied 
        on each iteration.
    @returns {Map} A shallow copy of <code>this</code> with each 
        property having passed through <code>call</code>.
    */
    d (mp, "map", H (function (call, thisarg) {
        var newObj = new Map();
        for (var key in this)
            newObj[key] = call.call (thisarg||this, this[key], key.slice(1), this);
        return newObj;
    }));
    
    
    /**
    Executes a callback for each property on <code>this</code> passing each 
        iteration's return value as a parameter to the next and producing a 
        single value. If no initial value is supplied, iteration begins on 
        the second property and the first property is used to initialize 
        the rolling value. The callback receives the rolling value, each 
        iterated value, each key and <code>this</code> as parameters, and 
        is applied either to <code>this</code> or <code>thisarg</code>.
    @name Map#reduce
    @function
    @param {Function} call The call to execute for each property.
    @param initial An optional value to initialize the rolling value.
    @returns The return value of the callback's final iteration.
    */
    d (mp, "reduce", H (function (call, initial) {
        var rollingValue;
        var keys = Object.keys (this);
        if (!keys.length)
            if (!initial)
                throw new TypeError ("Reduce of empty Object with no initial value");
            else return initial;
        if (initial)
            rollingValue = call (initial, this[keys[0]], keys[0], this);
        else
            if (keys.length == 1)
                return this[keys[0]];
            else
                rollingValue = call (this[keys[0]], this[keys[1]], keys[1], this);
        var i = initial ? 1 : 2;
        for (j=keys.length; i<j; i++)
            rollingValue = call (rollingValue, this[keys[i]], keys[i], this);
        return rollingValue;
    }));
    
    
    d (mp, "clone", H (function () {
        var newmap = new Map();
        for (var key in this)
            newmap[key] = this[key];
        return newmap;
    }));
//:
//:
})();
