app.filter('mappings', ['mappings', function (mappings) {
    return function (key, field) {
        key = key || 0;
        try {
            return mappings[field].choices[key].label;
        } catch(e) {
            return key;
        }
    };
}]);