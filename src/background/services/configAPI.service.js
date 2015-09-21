var configAPI = (function () {
    'use strict';

    function init(callback) {
        if (!window.config) {
            window.config = {};
        }

        idb.getAll('config', function (err, data) {
            _.each(data, function (item) {
                config[item.id] = item.value;
            });
            callback();
        });
    }

    function get(key) {
        return config[key];
    }

    function set(key, value) {
        config[key] = value;
        idb.set('config', {id: key, value: value}, _.noop);
    }

    function remove(key) {
        try {
            idb.remove('config', key, _.noop);
            delete config[key];
        } catch (e) {
            console.warn(e);
        }
    }

    return {
        init: init,
        get: get,
        set: set,
        remove: remove
    };
}());