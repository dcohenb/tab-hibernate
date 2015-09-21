var idb = (function () {
    'use strict';

    /**
     * PRIVATE VARS
     */
    var dataStores = {}; // Used for caching of data stores which are opened

    /**
     * getStore sees if a dataStore has already been initialized, if it doe's it continues to the call back
     * And if not, it will initialize the dataStore and then continue to the callback
     * @param storeName
     * @param callback
     * @returns {*}
     */
    function getStore(storeName, callback) {
        if (dataStores[storeName]) {
            return callback(null, dataStores[storeName]);
        }

        dataStores[storeName] = new IDBStore({
            dbVersion: 1,
            storeName: storeName,
            storePrefix: '',
            keyPath: 'id',
            onStoreReady: function () {
                callback(null, dataStores[storeName]);
            },
            onError: function(err){
                console.error("idb :: idb store error!", err);
                callback(err);
            }
        });
    }

    /**
     * Get an object from a specific dataStore
     * @dataStore - name of the dataStore.
     * @objectID - Unique object identifier.
     * @callback - Callback function with result.
     */
    function get(table, objectID, callback) {
        getStore(table, function (err, store) {
            if(err) return callback(err);

            store.get(objectID, function (result) {
                callback(null, result);
            }, function (err) {
                console.error("idb :: idb get error!", err);
                callback(err);
            });
        });
    }

    /**
     * Get a list of all the objects in a specific data store
     * @table - name of the dataStore.
     * @callback - Callback function with result.
     */
    function getAll(table, callback) {
        getStore(table, function (err, store) {
            if(err) return callback(err);

            store.getAll(function (result) {
                var obj = {};
                _.each(result, function (object) {
                    obj[object.id] = object;
                });
                callback(null, obj);
            }, function (err) {
                console.error("idb :: idb getAll error!", err);
                callback(err);
            });
        });
    }

    /**
     * Add/Update an object in the data store
     * @param table
     * @param objectData
     * @param callback
     */
    function set(table, objectData, callback) {
        getStore(table, function (err, store) {
            if(err) return callback(err);

            objectData.id = objectData.id ? objectData.id.toString() : _id();
            store.put(objectData, function (result) {
                callback(null, result);
            }, function (err) {
                console.error("idb :: idb set error!", err);
                callback(err);
            });
        });
    }

    /**
     * Delete an item from a dataStore by it's objectID
     * @dataStore - name of the dataStore.
     * @objectID - Unique object identifier.
     * @callback - Callback function with result.
     */
    /**
     *
     */
    function remove(table, objectID, callback) {
        getStore(table, function (err, store) {
            if(err) return callback(err);

            store.remove(objectID, function (result) {
                callback(null, result);
            }, function (err) {
                console.error("idb :: idb remove error!", err);
                callback(err);
            });
        });
    }

    /**
     *
     * @param table
     * @param callback
     */
    function clear(table, callback) {
        getStore(table, function (err, store) {
            if(err) return callback(err);

            store.clear(function () {
                callback(null);
            }, function (err) {
                console.error("idb :: idb clear error!", err);
                callback(err);
            });
        });
    }

    /**
     *
     * @param table
     * @param array
     * @param callback
     */
    function batch(table, array, callback) {
        getStore(table, function (err, store) {
            if(err) return callback(err);

            store.batch(array, function (results) {
                callback(null, results);
            }, function (err) {
                console.error("idb :: idb batch error!", err);
                callback(err);
            });
        });
    }

    /**
     * Generate a random id
     * @returns {*}
     * @private
     */
    function _id() {
        var s4 = function() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        };

        return s4() + s4();
    }

    /**
     * PUBLIC METHODS
     */
    return {
        getStore: getStore,
        get: get,
        getAll: getAll,
        set: set,
        remove: remove,
        clear: clear,
        batch: batch
    };
}());