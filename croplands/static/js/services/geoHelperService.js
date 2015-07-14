app.factory('geoHelperService', [ function () {
    /**
     * Calculates the ending location given a lat lon pair, bearing and distance.
     * @param latlon
     * @param bearing in degrees
     * @param distance in km
     * @returns {*[]}
     */
    function destination(latlon, bearing, distance) {
        var R = 6378.1, lat, lon, latDest, lonDest;

        // convert to radians
        lat = latlon[0] * (Math.PI / 180);
        lon = latlon[1] * (Math.PI / 180);
        bearing = bearing * (Math.PI / 180);

        latDest = Math.asin(Math.sin(lat) * Math.cos(distance / R) +
            Math.cos(lat) * Math.sin(distance / R) * Math.cos(bearing));

        lonDest = lon + Math.atan2(Math.sin(bearing) * Math.sin(distance / R) * Math.cos(lat),
                Math.cos(distance / R) - Math.sin(lat) * Math.sin(latDest));

        return [latDest * (180 / Math.PI), lonDest * (180 / Math.PI)];
    }

    return {
        destination: destination
    };
}]);
