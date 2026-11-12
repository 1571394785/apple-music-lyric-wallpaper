// This classic script must run before asynchronous module loading starts.
(function () {
    var pending = {};
    var receiver;
    var listener = {
        applyUserProperties: function (properties) {
            if (receiver) {
                receiver.applyUserProperties(properties);
            } else {
                Object.keys(properties).forEach(function (key) {
                    pending[key] = Object.assign({}, properties[key]);
                });
            }
        }
    };
    window.wallpaperPropertyListener = listener;
    window.wallpaperPropertyBridge = {
        connect: function (target) {
            receiver = target;
            window.wallpaperPropertyListener = listener;
            if (Object.keys(pending).length) receiver.applyUserProperties(pending);
            pending = {};
        }
    };
})();
