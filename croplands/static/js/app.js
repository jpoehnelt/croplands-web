/* Blob.js
 * A Blob implementation.
 * 2014-07-24
 *
 * By Eli Grey, http://eligrey.com
 * By Devin Samarin, https://github.com/dsamarin
 * License: X11/MIT
 *   See https://github.com/eligrey/Blob.js/blob/master/LICENSE.md
 */

/*global self, unescape */
/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,
  plusplus: true */

/*! @source http://purl.eligrey.com/github/Blob.scripts/blob/master/Blob.scripts */

(function (view) {
	"use strict";

	view.URL = view.URL || view.webkitURL;

	if (view.Blob && view.URL) {
		try {
			new Blob;
			return;
		} catch (e) {}
	}

	// Internally we use a BlobBuilder implementation to base Blob off of
	// in order to support older browsers that only have BlobBuilder
	var BlobBuilder = view.BlobBuilder || view.WebKitBlobBuilder || view.MozBlobBuilder || (function(view) {
		var
			  get_class = function(object) {
				return Object.prototype.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
			}
			, FakeBlobBuilder = function BlobBuilder() {
				this.data = [];
			}
			, FakeBlob = function Blob(data, type, encoding) {
				this.data = data;
				this.size = data.length;
				this.type = type;
				this.encoding = encoding;
			}
			, FBB_proto = FakeBlobBuilder.prototype
			, FB_proto = FakeBlob.prototype
			, FileReaderSync = view.FileReaderSync
			, FileException = function(type) {
				this.code = this[this.name = type];
			}
			, file_ex_codes = (
				  "NOT_FOUND_ERR SECURITY_ERR ABORT_ERR NOT_READABLE_ERR ENCODING_ERR "
				+ "NO_MODIFICATION_ALLOWED_ERR INVALID_STATE_ERR SYNTAX_ERR"
			).split(" ")
			, file_ex_code = file_ex_codes.length
			, real_URL = view.URL || view.webkitURL || view
			, real_create_object_URL = real_URL.createObjectURL
			, real_revoke_object_URL = real_URL.revokeObjectURL
			, URL = real_URL
			, btoa = view.btoa
			, atob = view.atob

			, ArrayBuffer = view.ArrayBuffer
			, Uint8Array = view.Uint8Array

			, origin = /^[\w-]+:\/*\[?[\w\.:-]+\]?(?::[0-9]+)?/
		;
		FakeBlob.fake = FB_proto.fake = true;
		while (file_ex_code--) {
			FileException.prototype[file_ex_codes[file_ex_code]] = file_ex_code + 1;
		}
		// Polyfill URL
		if (!real_URL.createObjectURL) {
			URL = view.URL = function(uri) {
				var
					  uri_info = document.createElementNS("http://www.w3.org/1999/xhtml", "a")
					, uri_origin
				;
				uri_info.href = uri;
				if (!("origin" in uri_info)) {
					if (uri_info.protocol.toLowerCase() === "data:") {
						uri_info.origin = null;
					} else {
						uri_origin = uri.match(origin);
						uri_info.origin = uri_origin && uri_origin[1];
					}
				}
				return uri_info;
			};
		}
		URL.createObjectURL = function(blob) {
			var
				  type = blob.type
				, data_URI_header
			;
			if (type === null) {
				type = "application/octet-stream";
			}
			if (blob instanceof FakeBlob) {
				data_URI_header = "data:" + type;
				if (blob.encoding === "base64") {
					return data_URI_header + ";base64," + blob.data;
				} else if (blob.encoding === "URI") {
					return data_URI_header + "," + decodeURIComponent(blob.data);
				} if (btoa) {
					return data_URI_header + ";base64," + btoa(blob.data);
				} else {
					return data_URI_header + "," + encodeURIComponent(blob.data);
				}
			} else if (real_create_object_URL) {
				return real_create_object_URL.call(real_URL, blob);
			}
		};
		URL.revokeObjectURL = function(object_URL) {
			if (object_URL.substring(0, 5) !== "data:" && real_revoke_object_URL) {
				real_revoke_object_URL.call(real_URL, object_URL);
			}
		};
		FBB_proto.append = function(data/*, endings*/) {
			var bb = this.data;
			// decode data to a binary string
			if (Uint8Array && (data instanceof ArrayBuffer || data instanceof Uint8Array)) {
				var
					  str = ""
					, buf = new Uint8Array(data)
					, i = 0
					, buf_len = buf.length
				;
				for (; i < buf_len; i++) {
					str += String.fromCharCode(buf[i]);
				}
				bb.push(str);
			} else if (get_class(data) === "Blob" || get_class(data) === "File") {
				if (FileReaderSync) {
					var fr = new FileReaderSync;
					bb.push(fr.readAsBinaryString(data));
				} else {
					// async FileReader won't work as BlobBuilder is sync
					throw new FileException("NOT_READABLE_ERR");
				}
			} else if (data instanceof FakeBlob) {
				if (data.encoding === "base64" && atob) {
					bb.push(atob(data.data));
				} else if (data.encoding === "URI") {
					bb.push(decodeURIComponent(data.data));
				} else if (data.encoding === "raw") {
					bb.push(data.data);
				}
			} else {
				if (typeof data !== "string") {
					data += ""; // convert unsupported types to strings
				}
				// decode UTF-16 to binary string
				bb.push(unescape(encodeURIComponent(data)));
			}
		};
		FBB_proto.getBlob = function(type) {
			if (!arguments.length) {
				type = null;
			}
			return new FakeBlob(this.data.join(""), type, "raw");
		};
		FBB_proto.toString = function() {
			return "[object BlobBuilder]";
		};
		FB_proto.slice = function(start, end, type) {
			var args = arguments.length;
			if (args < 3) {
				type = null;
			}
			return new FakeBlob(
				  this.data.slice(start, args > 1 ? end : this.data.length)
				, type
				, this.encoding
			);
		};
		FB_proto.toString = function() {
			return "[object Blob]";
		};
		FB_proto.close = function() {
			this.size = 0;
			delete this.data;
		};
		return FakeBlobBuilder;
	}(view));

	view.Blob = function(blobParts, options) {
		var type = options ? (options.type || "") : "";
		var builder = new BlobBuilder();
		if (blobParts) {
			for (var i = 0, len = blobParts.length; i < len; i++) {
				builder.append(blobParts[i]);
			}
		}
		return builder.getBlob(type);
	};
}(typeof self !== "undefined" && self || typeof window !== "undefined" && window || this.content || this));;
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 2014-12-17
 *
 * By Eli Grey, http://eligrey.com
 * License: X11/MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.scripts/blob/master/FileSaver.scripts */

var saveAs = saveAs
  // IE 10+ (native saveAs)
  || (typeof navigator !== "undefined" &&
      navigator.msSaveOrOpenBlob && navigator.msSaveOrOpenBlob.bind(navigator))
  // Everyone else
  || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" &&
	    /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.scripts hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = doc.createEvent("MouseEvents");
			event.initMouseEvent(
				"click", true, false, view, 0, 0, 0, 0, 0
				, false, false, false, false, 0, null
			);
			node.dispatchEvent(event);
		}
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// See https://code.google.com/p/chromium/issues/detail?id=375297#c7 and
		// https://github.com/eligrey/FileSaver.scripts/commit/485930a#commitcomment-8768047
		// for the reasoning behind the timeout and revocation flow
		, arbitrary_revoke_timeout = 500 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			if (view.chrome) {
				revoker();
			} else {
				setTimeout(revoker, arbitrary_revoke_timeout);
			}
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, FileSaver = function(blob, name) {
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab == undefined && typeof safari !== "undefined") {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				save_link.href = object_url;
				save_link.download = name;
				click(save_link);
				filesaver.readyState = filesaver.DONE;
				dispatch_all();
				revoke(object_url);
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name) {
			return new FileSaver(blob, name);
		}
	;
	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd != null)) {
  define([], function() {
    return saveAs;
  });
};
(function () {

    "use strict";

    angular.module("leaflet-directive", []).directive('leaflet', ["$q", "leafletData", "leafletMapDefaults", "leafletHelpers", "leafletEvents", function ($q, leafletData, leafletMapDefaults, leafletHelpers, leafletEvents) {
        var _leafletMap;
        return {
            restrict: "EA",
            replace: true,
            scope: {
                center: '=center',
                defaults: '=defaults',
                maxbounds: '=maxbounds',
                bounds: '=bounds',
                markers: '=markers',
                legend: '=legend',
                geojson: '=geojson',
                paths: '=paths',
                tiles: '=tiles',
                layers: '=layers',
                controls: '=controls',
                decorations: '=decorations',
                eventBroadcast: '=eventBroadcast'
            },
            transclude: true,
            template: '<div class="angular-leaflet-map"><div ng-transclude></div></div>',
            controller: ["$scope", function ($scope) {
                _leafletMap = $q.defer();
                this.getMap = function () {
                    return _leafletMap.promise;
                };

                this.getLeafletScope = function () {
                    return $scope;
                };
            }],

            link: function (scope, element, attrs) {
                var isDefined = leafletHelpers.isDefined,
                    defaults = leafletMapDefaults.setDefaults(scope.defaults, attrs.id),
                    genDispatchMapEvent = leafletEvents.genDispatchMapEvent,
                    mapEvents = leafletEvents.getAvailableMapEvents();

                // Set width and height if they are defined
                if (isDefined(attrs.width)) {
                    if (isNaN(attrs.width)) {
                        element.css('width', attrs.width);
                    } else {
                        element.css('width', attrs.width + 'px');
                    }
                }
                if (isDefined(attrs.height)) {
                    if (isNaN(attrs.height)) {
                        element.css('height', attrs.height);
                    } else {
                        element.css('height', attrs.height + 'px');
                    }
                }

                // Create the Leaflet Map Object with the options
                var map = new L.Map(element[0], leafletMapDefaults.getMapCreationDefaults(attrs.id));
                _leafletMap.resolve(map);

                if (!isDefined(attrs.center)) {
                    map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                }

                // If no layers nor tiles defined, set the default tileLayer
                if (!isDefined(attrs.tiles) && (!isDefined(attrs.layers))) {
                    var tileLayerObj = L.tileLayer(defaults.tileLayer, defaults.tileLayerOptions);
                    tileLayerObj.addTo(map);
                    leafletData.setTiles(tileLayerObj, attrs.id);
                }

                // Set zoom control configuration
                if (isDefined(map.zoomControl) &&
                    isDefined(defaults.zoomControlPosition)) {
                    map.zoomControl.setPosition(defaults.zoomControlPosition);
                }

                if (isDefined(map.zoomControl) &&
                    defaults.zoomControl === false) {
                    map.zoomControl.removeFrom(map);
                }

                if (isDefined(map.zoomsliderControl) &&
                    isDefined(defaults.zoomsliderControl) &&
                    defaults.zoomsliderControl === false) {
                    map.zoomsliderControl.removeFrom(map);
                }


                // if no event-broadcast attribute, all events are broadcasted
                if (!isDefined(attrs.eventBroadcast)) {
                    var logic = "broadcast";
                    for (var i = 0; i < mapEvents.length; i++) {
                        var eventName = mapEvents[i];
                        map.on(eventName, genDispatchMapEvent(scope, eventName, logic), {
                            eventName: eventName
                        });
                    }
                }

                // Resolve the map object to the promises
                map.whenReady(function () {
                    leafletData.setMap(map, attrs.id);
                });

                scope.$on('$destroy', function () {
                    map.remove();
                    leafletData.unresolveMap(attrs.id);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('center',
        ["$log", "$q", "$location", "$timeout", "leafletMapDefaults", "leafletHelpers", "leafletBoundsHelpers", "leafletEvents", function ($log, $q, $location, $timeout, leafletMapDefaults, leafletHelpers, leafletBoundsHelpers, leafletEvents) {

            var isDefined = leafletHelpers.isDefined,
                isNumber = leafletHelpers.isNumber,
                isSameCenterOnMap = leafletHelpers.isSameCenterOnMap,
                safeApply = leafletHelpers.safeApply,
                isValidCenter = leafletHelpers.isValidCenter,
                isEmpty = leafletHelpers.isEmpty,
                isUndefinedOrEmpty = leafletHelpers.isUndefinedOrEmpty;

            var shouldInitializeMapWithBounds = function (bounds, center) {
                return (isDefined(bounds) && !isEmpty(bounds)) && isUndefinedOrEmpty(center);
            };

            var _leafletCenter;
            return {
                restrict: "A",
                scope: false,
                replace: false,
                require: 'leaflet',
                controller: function () {
                    _leafletCenter = $q.defer();
                    this.getCenter = function () {
                        return _leafletCenter.promise;
                    };
                },
                link: function (scope, element, attrs, controller) {
                    var leafletScope = controller.getLeafletScope(),
                        centerModel = leafletScope.center;

                    controller.getMap().then(function (map) {
                        var defaults = leafletMapDefaults.getDefaults(attrs.id);

                        if (attrs.center.search("-") !== -1) {
                            $log.error('The "center" variable can\'t use a "-" on his key name: "' + attrs.center + '".');
                            map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                            return;
                        } else if (shouldInitializeMapWithBounds(leafletScope.bounds, centerModel)) {
                            map.fitBounds(leafletBoundsHelpers.createLeafletBounds(leafletScope.bounds));
                            centerModel = map.getCenter();
                            safeApply(leafletScope, function (scope) {
                                scope.center = {
                                    lat: map.getCenter().lat,
                                    lng: map.getCenter().lng,
                                    zoom: map.getZoom(),
                                    autoDiscover: false
                                };
                            });
                            safeApply(leafletScope, function (scope) {
                                var mapBounds = map.getBounds();
                                var newScopeBounds = {
                                    northEast: {
                                        lat: mapBounds._northEast.lat,
                                        lng: mapBounds._northEast.lng
                                    },
                                    southWest: {
                                        lat: mapBounds._southWest.lat,
                                        lng: mapBounds._southWest.lng
                                    }
                                };
                                scope.bounds = newScopeBounds;
                            });
                        } else if (!isDefined(centerModel)) {
                            $log.error('The "center" property is not defined in the main scope');
                            map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                            return;
                        } else if (!(isDefined(centerModel.lat) && isDefined(centerModel.lng)) && !isDefined(centerModel.autoDiscover)) {
                            angular.copy(defaults.center, centerModel);
                        }

                        var urlCenterHash, mapReady;
                        if (attrs.urlHashCenter === "yes") {
                            var extractCenterFromUrl = function () {
                                var search = $location.search();
                                var centerParam;
                                if (isDefined(search.c)) {
                                    var cParam = search.c.split(":");
                                    if (cParam.length === 3) {
                                        centerParam = { lat: parseFloat(cParam[0]), lng: parseFloat(cParam[1]), zoom: parseInt(cParam[2], 10) };
                                    }
                                }
                                return centerParam;
                            };
                            urlCenterHash = extractCenterFromUrl();

                            leafletScope.$on('$locationChangeSuccess', function (event) {
                                var scope = event.currentScope;
                                //$log.debug("updated location...");
                                var urlCenter = extractCenterFromUrl();
                                if (isDefined(urlCenter) && !isSameCenterOnMap(urlCenter, map)) {
                                    //$log.debug("updating center model...", urlCenter);
                                    scope.center = {
                                        lat: urlCenter.lat,
                                        lng: urlCenter.lng,
                                        zoom: urlCenter.zoom
                                    };
                                }
                            });
                        }

                        leafletScope.$watch("center", function (center) {
                            //$log.debug("updated center model...");
                            // The center from the URL has priority
                            if (isDefined(urlCenterHash)) {
                                angular.copy(urlCenterHash, center);
                                urlCenterHash = undefined;
                            }

                            if (!isValidCenter(center) && center.autoDiscover !== true) {
                                $log.warn("[AngularJS - Leaflet] invalid 'center'");
                                //map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                                return;
                            }

                            if (center.autoDiscover === true) {
                                if (!isNumber(center.zoom)) {
                                    map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                                }
                                if (isNumber(center.zoom) && center.zoom > defaults.center.zoom) {
                                    map.locate({ setView: true, maxZoom: center.zoom });
                                } else if (isDefined(defaults.maxZoom)) {
                                    map.locate({ setView: true, maxZoom: defaults.maxZoom });
                                } else {
                                    map.locate({ setView: true });
                                }
                                return;
                            }

                            if (mapReady && isSameCenterOnMap(center, map)) {
                                //$log.debug("no need to update map again.");
                                return;
                            }

                            //$log.debug("updating map center...", center);
                            leafletScope.settingCenterFromScope = true;
                            map.setView([center.lat, center.lng], center.zoom);
                            leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                            $timeout(function () {
                                leafletScope.settingCenterFromScope = false;
                                //$log.debug("allow center scope updates");
                            });
                        }, true);

                        map.whenReady(function () {
                            mapReady = true;
                        });

                        map.on("moveend", function (/* event */) {
                            // Resolve the center after the first map position
                            _leafletCenter.resolve();
                            leafletEvents.notifyCenterUrlHashChanged(leafletScope, map, attrs, $location.search());
                            //$log.debug("updated center on map...");
                            if (isSameCenterOnMap(centerModel, map) || scope.settingCenterFromScope) {
                                //$log.debug("same center in model, no need to update again.");
                                return;
                            }
                            safeApply(leafletScope, function (scope) {
                                if (!leafletScope.settingCenterFromScope) {
                                    //$log.debug("updating center model...", map.getCenter(), map.getZoom());
                                    scope.center = {
                                        lat: map.getCenter().lat,
                                        lng: map.getCenter().lng,
                                        zoom: map.getZoom(),
                                        autoDiscover: false
                                    };
                                }
                                leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                            });
                        });

                        if (centerModel.autoDiscover === true) {
                            map.on("locationerror", function () {
                                $log.warn("[AngularJS - Leaflet] The Geolocation API is unauthorized on this page.");
                                if (isValidCenter(centerModel)) {
                                    map.setView([centerModel.lat, centerModel.lng], centerModel.zoom);
                                    leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                                } else {
                                    map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                                    leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                                }
                            });
                        }
                    });
                }
            };
        }]);

    angular.module("leaflet-directive").directive('tiles', ["$log", "leafletData", "leafletMapDefaults", "leafletHelpers", function ($log, leafletData, leafletMapDefaults, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    tiles = leafletScope.tiles;

                if (!isDefined(tiles) && !isDefined(tiles.url)) {
                    $log.warn("[AngularJS - Leaflet] The 'tiles' definition doesn't have the 'url' property.");
                    return;
                }

                controller.getMap().then(function (map) {
                    var defaults = leafletMapDefaults.getDefaults(attrs.id);
                    var tileLayerObj;
                    leafletScope.$watch("tiles", function (tiles) {
                        var tileLayerOptions = defaults.tileLayerOptions;
                        var tileLayerUrl = defaults.tileLayer;

                        // If no valid tiles are in the scope, remove the last layer
                        if (!isDefined(tiles.url) && isDefined(tileLayerObj)) {
                            map.removeLayer(tileLayerObj);
                            return;
                        }

                        // No leafletTiles object defined yet
                        if (!isDefined(tileLayerObj)) {
                            if (isDefined(tiles.options)) {
                                angular.copy(tiles.options, tileLayerOptions);
                            }

                            if (isDefined(tiles.url)) {
                                tileLayerUrl = tiles.url;
                            }

                            tileLayerObj = L.tileLayer(tileLayerUrl, tileLayerOptions);
                            tileLayerObj.addTo(map);
                            leafletData.setTiles(tileLayerObj, attrs.id);
                            return;
                        }

                        // If the options of the tilelayer is changed, we need to redraw the layer
                        if (isDefined(tiles.url) && isDefined(tiles.options) && !angular.equals(tiles.options, tileLayerOptions)) {
                            map.removeLayer(tileLayerObj);
                            tileLayerOptions = defaults.tileLayerOptions;
                            angular.copy(tiles.options, tileLayerOptions);
                            tileLayerUrl = tiles.url;
                            tileLayerObj = L.tileLayer(tileLayerUrl, tileLayerOptions);
                            tileLayerObj.addTo(map);
                            leafletData.setTiles(tileLayerObj, attrs.id);
                            return;
                        }

                        // Only the URL of the layer is changed, update the tiles object
                        if (isDefined(tiles.url)) {
                            tileLayerObj.setUrl(tiles.url);
                        }
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('legend', ["$log", "$http", "leafletHelpers", "leafletLegendHelpers", function ($log, $http, leafletHelpers, leafletLegendHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var isArray = leafletHelpers.isArray,
                    isDefined = leafletHelpers.isDefined,
                    isFunction = leafletHelpers.isFunction,
                    leafletScope = controller.getLeafletScope(),
                    legend = leafletScope.legend;

                var legendClass = legend.legendClass ? legend.legendClass : "legend";
                var position = legend.position || 'bottomright';
                var leafletLegend;

                controller.getMap().then(function (map) {
                    leafletScope.$watch('legend', function (legend) {
                        if (!isDefined(legend.url) && (!isArray(legend.colors) || !isArray(legend.labels) || legend.colors.length !== legend.labels.length)) {
                            $log.warn("[AngularJS - Leaflet] legend.colors and legend.labels must be set.");
                        } else if (isDefined(legend.url)) {
                            $log.info("[AngularJS - Leaflet] loading arcgis legend service.");
                        } else {
                            if (isDefined(leafletLegend)) {
                                leafletLegend.removeFrom(map);
                            }
                            leafletLegend = L.control({ position: position });
                            leafletLegend.onAdd = leafletLegendHelpers.getOnAddArrayLegend(legend, legendClass);
                            leafletLegend.addTo(map);
                        }
                    });

                    leafletScope.$watch('legend.url', function (newURL) {
                        if (!isDefined(newURL)) {
                            return;
                        }
                        $http.get(newURL)
                            .success(function (legendData) {
                                if (isDefined(leafletLegend)) {
                                    leafletLegendHelpers.updateArcGISLegend(leafletLegend.getContainer(), legendData);
                                } else {
                                    leafletLegend = L.control({ position: position });
                                    leafletLegend.onAdd = leafletLegendHelpers.getOnAddArcGISLegend(legendData, legendClass);
                                    leafletLegend.addTo(map);
                                }
                                if (isDefined(legend.loadedData) && isFunction(legend.loadedData)) {
                                    legend.loadedData();
                                }
                            })
                            .error(function () {
                                $log.warn('[AngularJS - Leaflet] legend.url not loaded.');
                            });
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('geojson', ["$log", "$rootScope", "leafletData", "leafletHelpers", function ($log, $rootScope, leafletData, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var safeApply = leafletHelpers.safeApply,
                    isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    leafletGeoJSON = {};

                controller.getMap().then(function (map) {
                    leafletScope.$watch("geojson", function (geojson) {
                        if (isDefined(leafletGeoJSON) && map.hasLayer(leafletGeoJSON)) {
                            map.removeLayer(leafletGeoJSON);
                        }

                        if (!(isDefined(geojson) && isDefined(geojson.data))) {
                            return;
                        }

                        var resetStyleOnMouseout = geojson.resetStyleOnMouseout,
                            onEachFeature = geojson.onEachFeature;

                        if (!onEachFeature) {
                            onEachFeature = function (feature, layer) {
                                if (leafletHelpers.LabelPlugin.isLoaded() && isDefined(geojson.label)) {
                                    layer.bindLabel(feature.properties.description);
                                }

                                layer.on({
                                    mouseover: function (e) {
                                        safeApply(leafletScope, function () {
                                            geojson.selected = feature;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonMouseover', e);
                                        });
                                    },
                                    mouseout: function (e) {
                                        if (resetStyleOnMouseout) {
                                            leafletGeoJSON.resetStyle(e.target);
                                        }
                                        safeApply(leafletScope, function () {
                                            geojson.selected = undefined;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonMouseout', e);
                                        });
                                    },
                                    click: function (e) {
                                        safeApply(leafletScope, function () {
                                            geojson.selected = feature;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonClick', geojson.selected, e);
                                        });
                                    }
                                });
                            };
                        }

                        geojson.options = {
                            style: geojson.style,
                            filter: geojson.filter,
                            onEachFeature: onEachFeature,
                            pointToLayer: geojson.pointToLayer
                        };

                        leafletGeoJSON = L.geoJson(geojson.data, geojson.options);
                        leafletData.setGeoJSON(leafletGeoJSON, attrs.id);
                        leafletGeoJSON.addTo(map);
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('layers', ["$log", "$q", "leafletData", "leafletHelpers", "leafletLayerHelpers", "leafletControlHelpers", function ($log, $q, leafletData, leafletHelpers, leafletLayerHelpers, leafletControlHelpers) {
        var _leafletLayers;

        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',
            controller: function () {
                _leafletLayers = $q.defer();
                this.getLayers = function () {
                    return _leafletLayers.promise;
                };
            },
            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    leafletLayers = {},
                    leafletScope = controller.getLeafletScope(),
                    layers = leafletScope.layers,
                    createLayer = leafletLayerHelpers.createLayer,
                    updateLayersControl = leafletControlHelpers.updateLayersControl,
                    isLayersControlVisible = false;

                controller.getMap().then(function (map) {
                    // Do we have a baselayers property?
                    if (!isDefined(layers) || !isDefined(layers.baselayers) || Object.keys(layers.baselayers).length === 0) {
                        // No baselayers property
                        $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                        return;
                    }

                    // We have baselayers to add to the map
                    _leafletLayers.resolve(leafletLayers);
                    leafletData.setLayers(leafletLayers, attrs.id);

                    leafletLayers.baselayers = {};
                    leafletLayers.overlays = {};

                    var mapId = attrs.id;

                    // Setup all baselayers definitions
                    var oneVisibleLayer = false;
                    for (var layerName in layers.baselayers) {
                        var newBaseLayer = createLayer(layers.baselayers[layerName]);
                        if (!isDefined(newBaseLayer)) {
                            delete layers.baselayers[layerName];
                            continue;
                        }
                        leafletLayers.baselayers[layerName] = newBaseLayer;
                        // Only add the visible layer to the map, layer control manages the addition to the map
                        // of layers in its control
                        if (layers.baselayers[layerName].top === true) {
                            map.addLayer(leafletLayers.baselayers[layerName]);
                            oneVisibleLayer = true;
                        }
                    }

                    // If there is no visible layer add first to the map
                    if (!oneVisibleLayer && Object.keys(leafletLayers.baselayers).length > 0) {
                        map.addLayer(leafletLayers.baselayers[Object.keys(layers.baselayers)[0]]);
                    }

                    // Setup the Overlays
                    for (layerName in layers.overlays) {
                        if (layers.overlays[layerName].type === 'cartodb') {

                        }
                        var newOverlayLayer = createLayer(layers.overlays[layerName]);
                        if (!isDefined(newOverlayLayer)) {
                            delete layers.overlays[layerName];
                            continue;
                        }
                        leafletLayers.overlays[layerName] = newOverlayLayer;
                        // Only add the visible overlays to the map
                        if (layers.overlays[layerName].visible === true) {
                            map.addLayer(leafletLayers.overlays[layerName]);
                        }
                    }

                    // Watch for the base layers
                    leafletScope.$watch('layers.baselayers', function (newBaseLayers) {
                        // Delete layers from the array
                        for (var name in leafletLayers.baselayers) {
                            if (!isDefined(newBaseLayers[name]) || newBaseLayers[name].refresh) {
                                // Remove from the map if it's on it
                                if (map.hasLayer(leafletLayers.baselayers[name])) {
                                    map.removeLayer(leafletLayers.baselayers[name]);
                                }
                                delete leafletLayers.baselayers[name];
                            }
                        }
                        // add new layers
                        for (var newName in newBaseLayers) {
                            if (!isDefined(leafletLayers.baselayers[newName])) {
                                var testBaseLayer = createLayer(newBaseLayers[newName]);
                                if (isDefined(testBaseLayer)) {
                                    leafletLayers.baselayers[newName] = testBaseLayer;
                                    // Only add the visible layer to the map
                                    if (newBaseLayers[newName].top === true) {
                                        map.addLayer(leafletLayers.baselayers[newName]);
                                    }
                                }
                            }
                        }
                        if (Object.keys(leafletLayers.baselayers).length === 0) {
                            $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                            return;
                        }

                        //we have layers, so we need to make, at least, one active
                        var found = false;
                        // search for an active layer
                        for (var key in leafletLayers.baselayers) {
                            if (map.hasLayer(leafletLayers.baselayers[key])) {
                                found = true;
                                break;
                            }
                        }
                        // If there is no active layer make one active
                        if (!found) {
                            map.addLayer(leafletLayers.baselayers[Object.keys(layers.baselayers)[0]]);
                        }

                        // Only show the layers switch selector control if we have more than one baselayer + overlay
                        isLayersControlVisible = updateLayersControl(map, mapId, isLayersControlVisible, newBaseLayers, layers.overlays, leafletLayers);
                    }, true);

                    // Watch for the overlay layers
                    leafletScope.$watch('layers.overlays', function (newOverlayLayers) {
                        // Delete layers from the array
                        for (var name in leafletLayers.overlays) {
                            if (!isDefined(newOverlayLayers[name]) || newOverlayLayers[name].refresh) {
                                // Remove from the map if it's on it
                                if (map.hasLayer(leafletLayers.overlays[name])) {
                                    map.removeLayer(leafletLayers.overlays[name]);
                                }
                                // TODO: Depending on the layer type we will have to delete what's included on it
                                delete leafletLayers.overlays[name];
                            }
                        }

                        // add new overlays
                        for (var newName in newOverlayLayers) {
                            if (!isDefined(leafletLayers.overlays[newName])) {
                                var testOverlayLayer = createLayer(newOverlayLayers[newName]);
                                if (isDefined(testOverlayLayer)) {
                                    leafletLayers.overlays[newName] = testOverlayLayer;
                                    if (newOverlayLayers[newName].visible === true) {
                                        map.addLayer(leafletLayers.overlays[newName]);
                                    }
                                }
                            }// layer already exists, update options if appropriate
                            else {
                                if (newOverlayLayers[newName].layerOptions && newOverlayLayers[newName].layerOptions.opacity) {
                                    if (leafletLayers.overlays[newName].options.opacity != newOverlayLayers[newName].layerOptions.opacity) {
                                        leafletLayers.overlays[newName].setOpacity(newOverlayLayers[newName].layerOptions.opacity);
                                    }
                                }

                                if (newOverlayLayers[newName].layerOptions && newOverlayLayers[newName].layerOptions.zIndex) {
                                    if (leafletLayers.overlays.options.zIndex != newOverlayLayers[newName].layerOptions.zIndex) {
                                        leafletLayers.overlays.setZIndex(newOverlayLayers[newName].layerOptions.zIndex);
                                    }
                                }
                            }

                            // check for the .visible property to hide/show overLayers
                            if (newOverlayLayers[newName].visible && !map.hasLayer(leafletLayers.overlays[newName])) {
                                map.addLayer(leafletLayers.overlays[newName]);
                            } else if (newOverlayLayers[newName].visible === false && map.hasLayer(leafletLayers.overlays[newName])) {
                                map.removeLayer(leafletLayers.overlays[newName]);
                            }
                        }

                        // Only add the layers switch selector control if we have more than one baselayer + overlay
                        isLayersControlVisible = updateLayersControl(map, mapId, isLayersControlVisible, layers.baselayers, newOverlayLayers, leafletLayers);
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('bounds', ["$log", "$timeout", "leafletHelpers", "leafletBoundsHelpers", function ($log, $timeout, leafletHelpers, leafletBoundsHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: [ 'leaflet', 'center' ],

            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    createLeafletBounds = leafletBoundsHelpers.createLeafletBounds,
                    leafletScope = controller[0].getLeafletScope(),
                    mapController = controller[0];

                var emptyBounds = function (bounds) {
                    if (bounds._southWest.lat === 0 && bounds._southWest.lng === 0 && bounds._northEast.lat === 0 && bounds._northEast.lng === 0) {
                        return true;
                    }
                    return false;
                };

                mapController.getMap().then(function (map) {
                    leafletScope.$on('boundsChanged', function (event) {
                        var scope = event.currentScope;
                        var bounds = map.getBounds();
                        //$log.debug('updated map bounds...', bounds);
                        if (emptyBounds(bounds) || scope.settingBoundsFromScope) {
                            return;
                        }
                        var newScopeBounds = {
                            northEast: {
                                lat: bounds._northEast.lat,
                                lng: bounds._northEast.lng
                            },
                            southWest: {
                                lat: bounds._southWest.lat,
                                lng: bounds._southWest.lng
                            }
                        };
                        if (!angular.equals(scope.bounds, newScopeBounds)) {
                            //$log.debug('Need to update scope bounds.');
                            scope.bounds = newScopeBounds;
                        }
                    });
                    leafletScope.$watch('bounds', function (bounds) {
                        //$log.debug('updated bounds...', bounds);
                        if (!isDefined(bounds)) {
                            $log.error('[AngularJS - Leaflet] Invalid bounds');
                            return;
                        }
                        var leafletBounds = createLeafletBounds(bounds);
                        if (leafletBounds && !map.getBounds().equals(leafletBounds)) {
                            //$log.debug('Need to update map bounds.');
                            scope.settingBoundsFromScope = true;
                            map.fitBounds(leafletBounds);
                            $timeout(function () {
                                //$log.debug('Allow bound updates.');
                                scope.settingBoundsFromScope = false;
                            });
                        }
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('markers', ["$log", "$rootScope", "$q", "leafletData", "leafletHelpers", "leafletMapDefaults", "leafletMarkersHelpers", "leafletEvents", function ($log, $rootScope, $q, leafletData, leafletHelpers, leafletMapDefaults, leafletMarkersHelpers, leafletEvents) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: ['leaflet', '?layers'],

            link: function (scope, element, attrs, controller) {
                var mapController = controller[0],
                    Helpers = leafletHelpers,
                    isDefined = leafletHelpers.isDefined,
                    isString = leafletHelpers.isString,
                    leafletScope = mapController.getLeafletScope(),
                    deleteMarker = leafletMarkersHelpers.deleteMarker,
                    addMarkerWatcher = leafletMarkersHelpers.addMarkerWatcher,
                    listenMarkerEvents = leafletMarkersHelpers.listenMarkerEvents,
                    addMarkerToGroup = leafletMarkersHelpers.addMarkerToGroup,
                    bindMarkerEvents = leafletEvents.bindMarkerEvents,
                    createMarker = leafletMarkersHelpers.createMarker;

                mapController.getMap().then(function (map) {
                    var leafletMarkers = {},
                        getLayers;

                    // If the layers attribute is used, we must wait until the layers are created
                    if (isDefined(controller[1])) {
                        getLayers = controller[1].getLayers;
                    } else {
                        getLayers = function () {
                            var deferred = $q.defer();
                            deferred.resolve();
                            return deferred.promise;
                        };
                    }
//                    leafletMarkers.on('animationend', function () {
//                        console.log('end')
//                    })
                    getLayers().then(function (layers) {
                        leafletData.setMarkers(leafletMarkers, attrs.id);
                        leafletScope.$watch('markers', function (newMarkers) {
                            // Delete markers from the array
                            for (var name in leafletMarkers) {
                                deleteMarker(leafletMarkers[name], map, layers);
                                delete leafletMarkers[name];
                            }

                            // add new markers
                            for (var newName in newMarkers) {
                                if (newName.search("-") !== -1) {
                                    $log.error('The marker can\'t use a "-" on his key name: "' + newName + '".');
                                    continue;
                                }

                                if (!isDefined(leafletMarkers[newName])) {
                                    var markerData = newMarkers[newName];
                                    var marker = createMarker(markerData);
                                    if (!isDefined(marker)) {
                                        $log.error('[AngularJS - Leaflet] Received invalid data on the marker ' + newName + '.');
                                        continue;
                                    }
                                    leafletMarkers[newName] = marker;

                                    // Bind message
                                    if (isDefined(markerData.message)) {
                                        marker.bindPopup(markerData.message, markerData.popupOptions);
                                    }

                                    // Add the marker to a cluster group if needed
                                    if (isDefined(markerData.group)) {
                                        var groupOptions = isDefined(markerData.groupOption) ? markerData.groupOption : null;
                                        addMarkerToGroup(marker, markerData.group, groupOptions, map);
                                    }

                                    // Show label if defined
                                    if (Helpers.LabelPlugin.isLoaded() && isDefined(markerData.label) && isDefined(markerData.label.message)) {
                                        marker.bindLabel(markerData.label.message, markerData.label.options);
                                    }

                                    // Check if the marker should be added to a layer


//                                    if (isDefined(markerData) && isDefined(markerData.layer)) {
                                    if (isDefined(markerData)) {
                                        if (!isString(markerData.layer)) {
//                                            $log.error('[AngularJS - Leaflet] A layername must be a string');
                                            markerData.layer = 'locations';
                                            continue;
                                        }
                                        if (!isDefined(layers)) {
//                                            $log.error('[AngularJS - Leaflet] You must add layers to the directive if the markers are going to use this functionality.');
                                            markerData.layer = 'locations';
                                            continue;
                                        }

                                        if (!isDefined(layers.overlays) || !isDefined(layers.overlays[markerData.layer])) {
                                            $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group"');
                                            continue;
                                        }
                                        var layerGroup = layers.overlays[markerData.layer];
                                        if (!(layerGroup instanceof L.LayerGroup || layerGroup instanceof L.FeatureGroup)) {
                                            $log.error('[AngularJS - Leaflet] Adding a marker to an overlay needs a overlay of the type "group" or "featureGroup"');
                                            continue;
                                        }

                                        // The marker goes to a correct layer group, so first of all we add it
                                        layerGroup.addLayer(marker);

                                        // The marker is automatically added to the map depending on the visibility
                                        // of the layer, so we only have to open the popup if the marker is in the map
                                        if (map.hasLayer(marker) && markerData.focus === true) {
                                            marker.openPopup();
                                        }

                                        // Add the marker to the map if it hasn't been added to a layer or to a group
                                    } else if (!isDefined(markerData.group)) {
                                        // We do not have a layer attr, so the marker goes to the map layer
                                        map.addLayer(marker);
                                        if (markerData.focus === true) {
                                            marker.openPopup();
                                        }
                                        if (Helpers.LabelPlugin.isLoaded() && isDefined(markerData.label) && isDefined(markerData.label.options) && markerData.label.options.noHide === true) {
                                            marker.showLabel();
                                        }
                                    }

                                    // Should we watch for every specific marker on the map?
                                    var shouldWatch = (!isDefined(attrs.watchMarkers) || attrs.watchMarkers === 'true');

                                    if (shouldWatch) {
                                        addMarkerWatcher(marker, newName, leafletScope, layers, map);
                                        listenMarkerEvents(marker, markerData, leafletScope);
                                    }
                                    bindMarkerEvents(marker, newName, markerData, leafletScope);
                                }
                            }
                        }, true);
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('paths', ["$log", "$q", "leafletData", "leafletMapDefaults", "leafletHelpers", "leafletPathsHelpers", "leafletEvents", function ($log, $q, leafletData, leafletMapDefaults, leafletHelpers, leafletPathsHelpers, leafletEvents) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: ['leaflet', '?layers'],

            link: function (scope, element, attrs, controller) {
                var mapController = controller[0],
                    isDefined = leafletHelpers.isDefined,
                    isString = leafletHelpers.isString,
                    leafletScope = mapController.getLeafletScope(),
                    paths = leafletScope.paths,
                    createPath = leafletPathsHelpers.createPath,
                    bindPathEvents = leafletEvents.bindPathEvents,
                    setPathOptions = leafletPathsHelpers.setPathOptions;

                mapController.getMap().then(function (map) {
                    var defaults = leafletMapDefaults.getDefaults(attrs.id),
                        getLayers;

                    // If the layers attribute is used, we must wait until the layers are created
                    if (isDefined(controller[1])) {
                        getLayers = controller[1].getLayers;
                    } else {
                        getLayers = function () {
                            var deferred = $q.defer();
                            deferred.resolve();
                            return deferred.promise;
                        };
                    }

                    if (!isDefined(paths)) {
                        return;
                    }

                    getLayers().then(function (layers) {

                        var leafletPaths = {};
                        leafletData.setPaths(leafletPaths, attrs.id);

                        // Function for listening every single path once created
                        var watchPathFn = function (leafletPath, name) {
                            var clearWatch = leafletScope.$watch('paths.' + name, function (pathData) {
                                if (!isDefined(pathData)) {
                                    map.removeLayer(leafletPath);
                                    clearWatch();
                                    return;
                                }
                                setPathOptions(leafletPath, pathData.type, pathData);
                            }, true);
                        };

                        leafletScope.$watch("paths", function (newPaths) {

                            // Create the new paths
                            for (var newName in newPaths) {
                                if (newName.search('\\$') === 0) {
                                    continue;
                                }
                                if (newName.search("-") !== -1) {
                                    $log.error('[AngularJS - Leaflet] The path name "' + newName + '" is not valid. It must not include "-" and a number.');
                                    continue;
                                }

                                if (!isDefined(leafletPaths[newName])) {
                                    var pathData = newPaths[newName];
                                    var newPath = createPath(newName, newPaths[newName], defaults);

                                    // bind popup if defined
                                    if (isDefined(newPath) && isDefined(pathData.message)) {
                                        newPath.bindPopup(pathData.message);
                                    }

                                    // Show label if defined
                                    if (leafletHelpers.LabelPlugin.isLoaded() && isDefined(pathData.label) && isDefined(pathData.label.message)) {
                                        newPath.bindLabel(pathData.label.message, pathData.label.options);
                                    }

                                    // Check if the marker should be added to a layer
                                    if (isDefined(pathData) && isDefined(pathData.layer)) {

                                        if (!isString(pathData.layer)) {
                                            $log.error('[AngularJS - Leaflet] A layername must be a string');
                                            continue;
                                        }
                                        if (!isDefined(layers)) {
                                            $log.error('[AngularJS - Leaflet] You must add layers to the directive if the markers are going to use this functionality.');
                                            continue;
                                        }

                                        if (!isDefined(layers.overlays) || !isDefined(layers.overlays[pathData.layer])) {
                                            $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group"');
                                            continue;
                                        }
                                        var layerGroup = layers.overlays[pathData.layer];
                                        if (!(layerGroup instanceof L.LayerGroup || layerGroup instanceof L.FeatureGroup)) {
                                            $log.error('[AngularJS - Leaflet] Adding a marker to an overlay needs a overlay of the type "group" or "featureGroup"');
                                            continue;
                                        }

                                        // Listen for changes on the new path
                                        leafletPaths[newName] = newPath;
                                        // The path goes to a correct layer group, so first of all we add it
                                        layerGroup.addLayer(newPath);

                                        watchPathFn(newPath, newName);
                                    } else if (isDefined(newPath)) {
                                        // Listen for changes on the new path
                                        leafletPaths[newName] = newPath;
                                        map.addLayer(newPath);
                                        watchPathFn(newPath, newName);
                                    }

                                    bindPathEvents(newPath, newName, pathData, leafletScope);
                                }
                            }

                            // Delete paths (by name) from the array
                            for (var name in leafletPaths) {
                                if (!isDefined(newPaths[name])) {
                                    delete leafletPaths[name];
                                }
                            }

                        }, true);

                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('controls', ["$log", "leafletHelpers", function ($log, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: '?^leaflet',

            link: function (scope, element, attrs, controller) {
                if (!controller) {
                    return;
                }

                var isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    controls = leafletScope.controls;

                controller.getMap().then(function (map) {
                    if (isDefined(L.Control.Draw) && isDefined(controls.draw)) {
                        var drawnItems = new L.FeatureGroup();
                        var options = {
                            edit: {
                                featureGroup: drawnItems
                            }
                        };
                        angular.extend(options, controls.draw);
                        controls.draw = options;
                        map.addLayer(options.edit.featureGroup);

                        var drawControl = new L.Control.Draw(options);
                        map.addControl(drawControl);
                    }

                    if (isDefined(controls.custom)) {
                        for (var i in controls.custom) {
                            map.addControl(controls.custom[i]);
                        }
                    }
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('eventBroadcast', ["$log", "$rootScope", "leafletHelpers", "leafletEvents", function ($log, $rootScope, leafletHelpers, leafletEvents) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var isObject = leafletHelpers.isObject,
                    leafletScope = controller.getLeafletScope(),
//                eventBroadcast = leafletScope.eventBroadcast,
                    availableMapEvents = leafletEvents.getAvailableMapEvents(),
                    genDispatchMapEvent = leafletEvents.genDispatchMapEvent;

                controller.getMap().then(function (map) {
                    leafletScope.$watch("eventBroadcast", function (eventBroadcast) {

                        var mapEvents = [];
                        var i;
                        var eventName;
                        var logic = "broadcast";

                        if (isObject(eventBroadcast)) {
                            // We have a possible valid object
                            if (eventBroadcast.map === undefined || eventBroadcast.map === null) {
                                // We do not have events enable/disable do we do nothing (all enabled by default)
                                mapEvents = availableMapEvents;
                            } else if (typeof eventBroadcast.map !== 'object') {
                                // Not a valid object
                                $log.warn("[AngularJS - Leaflet] event-broadcast.map must be an object check your model.");
                            } else {
                                // We have a possible valid map object
                                // Event propadation logic
                                if (eventBroadcast.map.logic !== undefined && eventBroadcast.map.logic !== null) {
                                    // We take care of possible propagation logic
                                    if (eventBroadcast.map.logic !== "emit" && eventBroadcast.map.logic !== "broadcast") {
                                        // This is an error
                                        $log.warn("[AngularJS - Leaflet] Available event propagation logic are: 'emit' or 'broadcast'.");
                                    } else if (eventBroadcast.map.logic === "emit") {
                                        logic = "emit";
                                    }
                                }
                                // Enable / Disable
                                var mapEventsEnable = false, mapEventsDisable = false;
                                if (eventBroadcast.map.enable !== undefined && eventBroadcast.map.enable !== null) {
                                    if (typeof eventBroadcast.map.enable === 'object') {
                                        mapEventsEnable = true;
                                    }
                                }
                                if (eventBroadcast.map.disable !== undefined && eventBroadcast.map.disable !== null) {
                                    if (typeof eventBroadcast.map.disable === 'object') {
                                        mapEventsDisable = true;
                                    }
                                }
                                if (mapEventsEnable && mapEventsDisable) {
                                    // Both are active, this is an error
                                    $log.warn("[AngularJS - Leaflet] can not enable and disable events at the time");
                                } else if (!mapEventsEnable && !mapEventsDisable) {
                                    // Both are inactive, this is an error
                                    $log.warn("[AngularJS - Leaflet] must enable or disable events");
                                } else {
                                    // At this point the map object is OK, lets enable or disable events
                                    if (mapEventsEnable) {
                                        // Enable events
                                        for (i = 0; i < eventBroadcast.map.enable.length; i++) {
                                            eventName = eventBroadcast.map.enable[i];
                                            // Do we have already the event enabled?
                                            if (mapEvents.indexOf(eventName) !== -1) {
                                                // Repeated event, this is an error
                                                $log.warn("[AngularJS - Leaflet] This event " + eventName + " is already enabled");
                                            } else {
                                                // Does the event exists?
                                                if (availableMapEvents.indexOf(eventName) === -1) {
                                                    // The event does not exists, this is an error
                                                    $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist");
                                                } else {
                                                    // All ok enable the event
                                                    mapEvents.push(eventName);
                                                }
                                            }
                                        }
                                    } else {
                                        // Disable events
                                        mapEvents = availableMapEvents;
                                        for (i = 0; i < eventBroadcast.map.disable.length; i++) {
                                            eventName = eventBroadcast.map.disable[i];
                                            var index = mapEvents.indexOf(eventName);
                                            if (index === -1) {
                                                // The event does not exist
                                                $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist or has been already disabled");
                                            } else {
                                                mapEvents.splice(index, 1);
                                            }
                                        }
                                    }
                                }
                            }

                            for (i = 0; i < mapEvents.length; i++) {
                                eventName = mapEvents[i];
                                map.on(eventName, genDispatchMapEvent(leafletScope, eventName, logic), {
                                    eventName: eventName
                                });
                            }
                        } else {
                            // Not a valid object
                            $log.warn("[AngularJS - Leaflet] event-broadcast must be an object, check your model.");
                        }
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('maxbounds', ["$log", "leafletMapDefaults", "leafletBoundsHelpers", function ($log, leafletMapDefaults, leafletBoundsHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var leafletScope = controller.getLeafletScope(),
                    isValidBounds = leafletBoundsHelpers.isValidBounds;


                controller.getMap().then(function (map) {
                    leafletScope.$watch("maxbounds", function (maxbounds) {
                        if (!isValidBounds(maxbounds)) {
                            // Unset any previous maxbounds
                            map.setMaxBounds();
                            return;
                        }
                        var bounds = [
                            [ maxbounds.southWest.lat, maxbounds.southWest.lng ],
                            [ maxbounds.northEast.lat, maxbounds.northEast.lng ]
                        ];
                        map.setMaxBounds(bounds);

                        if (!attrs.center) {
                            map.fitBounds(bounds);
                        }
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive("decorations", ["$log", "leafletHelpers", function ($log, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var leafletScope = controller.getLeafletScope(),
                    PolylineDecoratorPlugin = leafletHelpers.PolylineDecoratorPlugin,
                    isDefined = leafletHelpers.isDefined,
                    leafletDecorations = {};

                /* Creates an "empty" decoration with a set of coordinates, but no pattern. */
                function createDecoration(options) {
                    if (isDefined(options) && isDefined(options.coordinates)) {
                        if (!PolylineDecoratorPlugin.isLoaded()) {
                            $log.error('[AngularJS - Leaflet] The PolylineDecorator Plugin is not loaded.');
                        }
                    }

                    return L.polylineDecorator(options.coordinates);
                }

                /* Updates the path and the patterns for the provided decoration, and returns the decoration. */
                function setDecorationOptions(decoration, options) {
                    if (isDefined(decoration) && isDefined(options)) {
                        if (isDefined(options.coordinates) && isDefined(options.patterns)) {
                            decoration.setPaths(options.coordinates);
                            decoration.setPatterns(options.patterns);
                            return decoration;
                        }
                    }
                }

                controller.getMap().then(function (map) {
                    leafletScope.$watch("decorations", function (newDecorations) {
                        for (var name in leafletDecorations) {
                            if (!isDefined(newDecorations) || !isDefined(newDecorations[name])) {
                                delete leafletDecorations[name];
                            }
                            map.removeLayer(leafletDecorations[name]);
                        }

                        for (var newName in newDecorations) {
                            var decorationData = newDecorations[newName],
                                newDecoration = createDecoration(decorationData);

                            if (isDefined(newDecoration)) {
                                leafletDecorations[newName] = newDecoration;
                                map.addLayer(newDecoration);
                                setDecorationOptions(newDecoration, decorationData);
                            }
                        }
                    }, true);
                });
            }
        };
    }]);
    angular.module("leaflet-directive").directive('layercontrol', ["$log", "leafletData", "leafletHelpers", function ($log, leafletData, leafletHelpers) {
        return {
            restrict: "E",
            scope: {
            },
            replace: true,
            transclude: false,
            require: '^leaflet',
            controller: ["$scope", "$element", "$sce", function ($scope, $element, $sce) {
                $log.debug('[Angular Directive - Layers] layers', $scope, $element);
                var safeApply = leafletHelpers.safeApply,
                    isDefined = leafletHelpers.isDefined;
                angular.extend($scope, {
                    baselayer: '',
                    icons: {
                        uncheck: 'fa fa-check-square-o',
                        check: 'fa fa-square-o',
                        radio: 'fa fa-dot-circle-o',
                        unradio: 'fa fa-circle-o',
                        up: 'fa fa-angle-up',
                        down: 'fa fa-angle-down',
                        open: 'fa fa-angle-double-down',
                        close: 'fa fa-angle-double-up'
                    },
                    changeBaseLayer: function (key, e) {
                        leafletHelpers.safeApply($scope, function (scp) {
                            scp.baselayer = key;
                            leafletData.getMap().then(function (map) {
                                leafletData.getLayers().then(function (leafletLayers) {
                                    if (map.hasLayer(leafletLayers.baselayers[key])) {
                                        return;
                                    }
                                    for (var i in scp.layers.baselayers) {
                                        scp.layers.baselayers[i].icon = scp.icons.unradio;
                                        if (map.hasLayer(leafletLayers.baselayers[i])) {
                                            map.removeLayer(leafletLayers.baselayers[i]);
                                        }
                                    }
                                    map.addLayer(leafletLayers.baselayers[key]);
                                    scp.layers.baselayers[key].icon = $scope.icons.radio;
                                });
                            });
                        });
                        e.preventDefault();
                    },
                    moveLayer: function (ly, newIndex, e) {
                        var delta = Object.keys($scope.layers.baselayers).length;
                        if (newIndex >= (1 + delta) && newIndex <= ($scope.overlaysArray.length + delta)) {
                            var oldLy;
                            for (var key in $scope.layers.overlays) {
                                if ($scope.layers.overlays[key].index === newIndex) {
                                    oldLy = $scope.layers.overlays[key];
                                    break;
                                }
                            }
                            if (oldLy) {
                                safeApply($scope, function () {
                                    oldLy.index = ly.index;
                                    ly.index = newIndex;
                                });
                            }
                        }
                        e.stopPropagation();
                        e.preventDefault();
                    },
                    initIndex: function (layer, idx) {
                        var delta = Object.keys($scope.layers.baselayers).length;
                        layer.index = isDefined(layer.index) ? layer.index : idx + delta + 1;
                    },
                    toggleOpacity: function (e, layer) {
                        $log.debug('Event', e);
                        if (layer.visible) {
                            var el = angular.element(e.currentTarget);
                            el.toggleClass($scope.icons.close + ' ' + $scope.icons.open);
                            el = el.parents('.lf-row').find('.lf-opacity');
                            el.toggle('fast', function () {
                                safeApply($scope, function () {
                                    layer.opacityControl = !layer.opacityControl;
                                });
                            });
                        }
                        e.stopPropagation();
                        e.preventDefault();
                    },
                    unsafeHTML: function (html) {
                        return $sce.trustAsHtml(html);
                    }
                });

                var div = $element.get(0);
                if (!L.Browser.touch) {
                    L.DomEvent.disableClickPropagation(div);
                    L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
                } else {
                    L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
                }
            }],
            template: '<div class="angular-leaflet-control-layers" ng-show="overlaysArray.length">' +
                '<div class="lf-baselayers">' +
                '<div class="lf-row" ng-repeat="(key, layer) in layers.baselayers">' +
                '<label class="lf-icon-bl" ng-click="changeBaseLayer(key, $event)">' +
                '<input class="leaflet-control-layers-selector" type="radio" name="lf-radio" ' +
                'ng-show="false" ng-checked="baselayer === key" ng-value="key" /> ' +
                '<i class="lf-icon lf-icon-radio" ng-class="layer.icon"></i>' +
                '<div class="lf-text">{{layer.name}}</div>' +
                '</label>' +
                '</div>' +
                '</div>' +
                '<div class="lf-overlays">' +
                '<div class="lf-container">' +
                '<div class="lf-row" ng-repeat="layer in overlaysArray | orderBy:\'index\':order" ng-init="initIndex(layer, $index)">' +
                '<label class="lf-icon-ol">' +
                '<input class="lf-control-layers-selector" type="checkbox" ng-show="false" ng-model="layer.visible"/> ' +
                '<i class="lf-icon lf-icon-check" ng-class="layer.icon"></i>' +
                '<div class="lf-text">{{layer.name}}</div>' +
                '<div class="lf-icons">' +
                '<i class="lf-icon lf-up" ng-class="icons.up" ng-click="moveLayer(layer, layer.index - orderNumber, $event)"></i> ' +
                '<i class="lf-icon lf-down" ng-class="icons.down" ng-click="moveLayer(layer, layer.index + orderNumber, $event)"></i> ' +
                '<i class="lf-icon lf-open" ng-class="layer.opacityControl? icons.close:icons.open" ng-click="toggleOpacity($event, layer)"></i>' +
                '</div>' +
                '</label>' +
                '<div class="lf-legend" ng-if="layer.legend" ng-bind-html="unsafeHTML(layer.legend)"></div>' +
                '<div class="lf-opacity" ng-show="layer.visible &amp;&amp; layer.opacityControl">' +
                '<input type="text" class="lf-opacity-control" name="lf-opacity-control" data-key="{{layer.index}}" />' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>',
            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    layers = leafletScope.layers;

                // Setting layer stack order.
                attrs.order = (isDefined(attrs.order) && (attrs.order === 'normal' || attrs.order === 'reverse')) ? attrs.order : 'normal';
                scope.order = attrs.order === 'normal';
                scope.orderNumber = attrs.order === 'normal' ? -1 : 1;

                scope.layers = layers;
                controller.getMap().then(function (map) {
                    // Do we have a baselayers property?
                    if (!isDefined(layers) || !isDefined(layers.baselayers) || Object.keys(layers.baselayers).length === 0) {
                        // No baselayers property
                        $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                        return;
                    }

                    leafletScope.$watch('layers.baselayers', function (newBaseLayers) {
                        leafletData.getLayers().then(function (leafletLayers) {
                            var key;
                            for (key in newBaseLayers) {
                                if (map.hasLayer(leafletLayers.baselayers[key])) {
                                    newBaseLayers[key].icon = scope.icons.radio;
                                } else {
                                    newBaseLayers[key].icon = scope.icons.unradio;
                                }
                            }
                        });
                    });

                    leafletScope.$watch('layers.overlays', function (newOverlayLayers) {
                        var overlaysArray = [];
                        leafletData.getLayers().then(function (leafletLayers) {
                            for (var key in newOverlayLayers) {
                                newOverlayLayers[key].icon = scope.icons[(newOverlayLayers[key].visible ? 'uncheck' : 'check')];
                                overlaysArray.push(newOverlayLayers[key]);
                                if (isDefined(newOverlayLayers[key].index) && leafletLayers.overlays[key].setZIndex) {
                                    leafletLayers.overlays[key].setZIndex(newOverlayLayers[key].index);
                                }
                            }
                        });

                        var unreg = scope.$watch(function () {
                            if (element.children().size() > 1) {
                                element.find('.lf-overlays').trigger('resize');
                                return element.find('.lf-opacity').size() === Object.keys(layers.overlays).length;
                            }
                        }, function (el) {
                            if (el === true) {
                                if (isDefined(element.find('.lf-opacity-control').ionRangeSlider)) {
                                    element.find('.lf-opacity-control').each(function (idx, inp) {
                                        var delta = Object.keys(layers.baselayers).length,
                                            lyAux;
                                        for (var key in scope.overlaysArray) {
                                            if (scope.overlaysArray[key].index === idx + delta + 1) {
                                                lyAux = scope.overlaysArray[key];
                                            }
                                        }

                                        var input = angular.element(inp),
                                            op = isDefined(lyAux) && isDefined(lyAux.layerOptions) ?
                                                lyAux.layerOptions.opacity : undefined;
                                        input.ionRangeSlider({
                                            min: 0,
                                            from: isDefined(op) ? Math.ceil(op * 100) : 100,
                                            step: 1,
                                            max: 100,
                                            prettify: false,
                                            hasGrid: false,
                                            hideMinMax: true,
                                            onChange: function (val) {
                                                leafletData.getLayers().then(function (leafletLayers) {
                                                    var key = val.input.data().key;
                                                    var ly, layer;
                                                    for (var k in layers.overlays) {
                                                        if (layers.overlays[k].index === key) {
                                                            ly = leafletLayers.overlays[k];
                                                            layer = layers.overlays[k];
                                                            break;
                                                        }
                                                    }
                                                    if (map.hasLayer(ly)) {
                                                        layer.layerOptions = isDefined(layer.layerOptions) ? layer.layerOptions : {};
                                                        layer.layerOptions.opacity = val.input.val() / 100;
                                                        if (ly.setOpacity) {
                                                            ly.setOpacity(val.input.val() / 100);
                                                        }
                                                        if (ly.getLayers && ly.eachLayer) {
                                                            ly.eachLayer(function (lay) {
                                                                if (lay.setOpacity) {
                                                                    lay.setOpacity(val.input.val() / 100);
                                                                }
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    });
                                } else {
                                    $log.warn('[AngularJS - Leaflet] Ion Slide Range Plugin is not loaded');
                                }
                                unreg();
                            }
                        });

                        scope.overlaysArray = overlaysArray;
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").service('leafletData', ["$log", "$q", "leafletHelpers", function ($log, $q, leafletHelpers) {
        var getDefer = leafletHelpers.getDefer,
            getUnresolvedDefer = leafletHelpers.getUnresolvedDefer,
            setResolvedDefer = leafletHelpers.setResolvedDefer;

        var maps = {};
        var tiles = {};
        var layers = {};
        var paths = {};
        var markers = {};
        var geoJSON = {};
        var utfGrid = {};
        var decorations = {};

        this.setMap = function (leafletMap, scopeId) {
            var defer = getUnresolvedDefer(maps, scopeId);
            defer.resolve(leafletMap);
            setResolvedDefer(maps, scopeId);
        };

        this.getMap = function (scopeId) {
            var defer = getDefer(maps, scopeId);
            return defer.promise;
        };

        this.unresolveMap = function (scopeId) {
            var id = leafletHelpers.obtainEffectiveMapId(maps, scopeId);
            maps[id] = undefined;
        };

        this.getPaths = function (scopeId) {
            var defer = getDefer(paths, scopeId);
            return defer.promise;
        };

        this.setPaths = function (leafletPaths, scopeId) {
            var defer = getUnresolvedDefer(paths, scopeId);
            defer.resolve(leafletPaths);
            setResolvedDefer(paths, scopeId);
        };

        this.getMarkers = function (scopeId) {
            var defer = getDefer(markers, scopeId);
            return defer.promise;
        };

        this.setMarkers = function (leafletMarkers, scopeId) {
            var defer = getUnresolvedDefer(markers, scopeId);
            defer.resolve(leafletMarkers);
            setResolvedDefer(markers, scopeId);
        };

        this.getLayers = function (scopeId) {
            var defer = getDefer(layers, scopeId);
            return defer.promise;
        };

        this.setLayers = function (leafletLayers, scopeId) {
            var defer = getUnresolvedDefer(layers, scopeId);
            defer.resolve(leafletLayers);
            setResolvedDefer(layers, scopeId);
        };

        this.getUTFGrid = function (scopeId) {
            var defer = getDefer(utfGrid, scopeId);
            return defer.promise;
        };

        this.setUTFGrid = function (leafletUTFGrid, scopeId) {
            var defer = getUnresolvedDefer(utfGrid, scopeId);
            defer.resolve(leafletUTFGrid);
            setResolvedDefer(utfGrid, scopeId);
        };

        this.setTiles = function (leafletTiles, scopeId) {
            var defer = getUnresolvedDefer(tiles, scopeId);
            defer.resolve(leafletTiles);
            setResolvedDefer(tiles, scopeId);
        };

        this.getTiles = function (scopeId) {
            var defer = getDefer(tiles, scopeId);
            return defer.promise;
        };

        this.setGeoJSON = function (leafletGeoJSON, scopeId) {
            var defer = getUnresolvedDefer(geoJSON, scopeId);
            defer.resolve(leafletGeoJSON);
            setResolvedDefer(geoJSON, scopeId);
        };

        this.getGeoJSON = function (scopeId) {
            var defer = getDefer(geoJSON, scopeId);
            return defer.promise;
        };

        this.setDecorations = function (leafletDecorations, scopeId) {
            var defer = getUnresolvedDefer(decorations, scopeId);
            defer.resolve(leafletDecorations);
            setResolvedDefer(decorations, scopeId);
        };

        this.getDecorations = function (scopeId) {
            var defer = getDefer(decorations, scopeId);
            return defer.promise;
        };
    }]);

    angular.module("leaflet-directive").factory('leafletMapDefaults', ["$q", "leafletHelpers", function ($q, leafletHelpers) {
        function _getDefaults() {
            return {
                keyboard: true,
                dragging: true,
                worldCopyJump: false,
                doubleClickZoom: true,
                scrollWheelZoom: true,
                touchZoom: true,
                zoomControl: true,
                zoomsliderControl: false,
                zoomControlPosition: 'topleft',
                attributionControl: true,
                controls: {
                    layers: {
                        visible: true,
                        position: 'topright',
                        collapsed: true
                    }
                },
                crs: L.CRS.EPSG3857,
                tileLayer: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                tileLayerOptions: {
                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                },
                path: {
                    weight: 10,
                    opacity: 1,
                    color: '#0000ff'
                },
                center: {
                    lat: 0,
                    lng: 0,
                    zoom: 1
                }
            };
        }

        var isDefined = leafletHelpers.isDefined,
            isObject = leafletHelpers.isObject,
            obtainEffectiveMapId = leafletHelpers.obtainEffectiveMapId,
            defaults = {};

        // Get the _defaults dictionary, and override the properties defined by the user
        return {
            getDefaults: function (scopeId) {
                var mapId = obtainEffectiveMapId(defaults, scopeId);
                return defaults[mapId];
            },

            getMapCreationDefaults: function (scopeId) {
                var mapId = obtainEffectiveMapId(defaults, scopeId);
                var d = defaults[mapId];

                var mapDefaults = {
                    maxZoom: d.maxZoom,
                    keyboard: d.keyboard,
                    dragging: d.dragging,
                    zoomControl: d.zoomControl,
                    doubleClickZoom: d.doubleClickZoom,
                    scrollWheelZoom: d.scrollWheelZoom,
                    touchZoom: d.touchZoom,
                    attributionControl: d.attributionControl,
                    worldCopyJump: d.worldCopyJump,
                    crs: d.crs
                };

                if (isDefined(d.minZoom)) {
                    mapDefaults.minZoom = d.minZoom;
                }

                if (isDefined(d.zoomAnimation)) {
                    mapDefaults.zoomAnimation = d.zoomAnimation;
                }

                if (isDefined(d.fadeAnimation)) {
                    mapDefaults.fadeAnimation = d.fadeAnimation;
                }

                if (isDefined(d.markerZoomAnimation)) {
                    mapDefaults.markerZoomAnimation = d.markerZoomAnimation;
                }

                if (d.map) {
                    for (var option in d.map) {
                        mapDefaults[option] = d.map[option];
                    }
                }

                return mapDefaults;
            },

            setDefaults: function (userDefaults, scopeId) {
                var newDefaults = _getDefaults();

                if (isDefined(userDefaults)) {
                    newDefaults.doubleClickZoom = isDefined(userDefaults.doubleClickZoom) ? userDefaults.doubleClickZoom : newDefaults.doubleClickZoom;
                    newDefaults.scrollWheelZoom = isDefined(userDefaults.scrollWheelZoom) ? userDefaults.scrollWheelZoom : newDefaults.doubleClickZoom;
                    newDefaults.touchZoom = isDefined(userDefaults.touchZoom) ? userDefaults.touchZoom : newDefaults.doubleClickZoom;
                    newDefaults.zoomControl = isDefined(userDefaults.zoomControl) ? userDefaults.zoomControl : newDefaults.zoomControl;
                    newDefaults.zoomsliderControl = isDefined(userDefaults.zoomsliderControl) ? userDefaults.zoomsliderControl : newDefaults.zoomsliderControl;
                    newDefaults.attributionControl = isDefined(userDefaults.attributionControl) ? userDefaults.attributionControl : newDefaults.attributionControl;
                    newDefaults.tileLayer = isDefined(userDefaults.tileLayer) ? userDefaults.tileLayer : newDefaults.tileLayer;
                    newDefaults.zoomControlPosition = isDefined(userDefaults.zoomControlPosition) ? userDefaults.zoomControlPosition : newDefaults.zoomControlPosition;
                    newDefaults.keyboard = isDefined(userDefaults.keyboard) ? userDefaults.keyboard : newDefaults.keyboard;
                    newDefaults.dragging = isDefined(userDefaults.dragging) ? userDefaults.dragging : newDefaults.dragging;

                    if (isDefined(userDefaults.controls)) {
                        angular.extend(newDefaults.controls, userDefaults.controls);
                    }

                    if (isObject(userDefaults.crs)) {
                        newDefaults.crs = userDefaults.crs;
                    } else if (isDefined(L.CRS[userDefaults.crs])) {
                        newDefaults.crs = L.CRS[userDefaults.crs];
                    }

                    if (isDefined(userDefaults.tileLayerOptions)) {
                        angular.copy(userDefaults.tileLayerOptions, newDefaults.tileLayerOptions);
                    }

                    if (isDefined(userDefaults.maxZoom)) {
                        newDefaults.maxZoom = userDefaults.maxZoom;
                    }

                    if (isDefined(userDefaults.minZoom)) {
                        newDefaults.minZoom = userDefaults.minZoom;
                    }

                    if (isDefined(userDefaults.zoomAnimation)) {
                        newDefaults.zoomAnimation = userDefaults.zoomAnimation;
                    }

                    if (isDefined(userDefaults.fadeAnimation)) {
                        newDefaults.fadeAnimation = userDefaults.fadeAnimation;
                    }

                    if (isDefined(userDefaults.markerZoomAnimation)) {
                        newDefaults.markerZoomAnimation = userDefaults.markerZoomAnimation;
                    }

                    if (isDefined(userDefaults.worldCopyJump)) {
                        newDefaults.worldCopyJump = userDefaults.worldCopyJump;
                    }

                    if (isDefined(userDefaults.map)) {
                        newDefaults.map = userDefaults.map;
                    }
                }

                var mapId = obtainEffectiveMapId(defaults, scopeId);
                defaults[mapId] = newDefaults;
                return newDefaults;
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletEvents', ["$rootScope", "$q", "$log", "leafletHelpers", function ($rootScope, $q, $log, leafletHelpers) {
        var safeApply = leafletHelpers.safeApply,
            isDefined = leafletHelpers.isDefined,
            isObject = leafletHelpers.isObject,
            Helpers = leafletHelpers;

        var _getAvailableLabelEvents = function () {
            return [
                'click',
                'dblclick',
                'mousedown',
                'mouseover',
                'mouseout',
                'contextmenu'
            ];
        };

        var genLabelEvents = function (leafletScope, logic, marker, name) {
            var labelEvents = _getAvailableLabelEvents();
            var scopeWatchName = "markers." + name;
            for (var i = 0; i < labelEvents.length; i++) {
                var eventName = labelEvents[i];
                marker.label.on(eventName, genDispatchLabelEvent(leafletScope, eventName, logic, marker.label, scopeWatchName));
            }
        };

        var genDispatchMarkerEvent = function (eventName, logic, leafletScope, marker, name, markerData) {
            return function (e) {
                var broadcastName = 'leafletDirectiveMarker.' + eventName;

                // Broadcast old marker click name for backwards compatibility
                if (eventName === "click") {
                    safeApply(leafletScope, function () {
                        $rootScope.$broadcast('leafletDirectiveMarkersClick', name);
                    });
                } else if (eventName === 'dragend') {
                    safeApply(leafletScope, function () {
                        markerData.lat = marker.getLatLng().lat;
                        markerData.lng = marker.getLatLng().lng;
                    });
                    if (markerData.message && markerData.focus === true) {
                        marker.openPopup();
                    }
                }

                safeApply(leafletScope, function (scope) {
                    if (logic === "emit") {
                        scope.$emit(broadcastName, {
                            markerName: name,
                            leafletEvent: e
                        });
                    } else {
                        $rootScope.$broadcast(broadcastName, {
                            markerName: name,
                            leafletEvent: e
                        });
                    }
                });
            };
        };

        var genDispatchPathEvent = function (eventName, logic, leafletScope, marker, name) {
            return function (e) {
                var broadcastName = 'leafletDirectivePath.' + eventName;

                safeApply(leafletScope, function (scope) {
                    if (logic === "emit") {
                        scope.$emit(broadcastName, {
                            pathName: name,
                            leafletEvent: e
                        });
                    } else {
                        $rootScope.$broadcast(broadcastName, {
                            pathName: name,
                            leafletEvent: e
                        });
                    }
                });
            };
        };

        var genDispatchLabelEvent = function (scope, eventName, logic, label, scope_watch_name) {
            return function (e) {
                // Put together broadcast name
                var broadcastName = 'leafletDirectiveLabel.' + eventName;
                var markerName = scope_watch_name.replace('markers.', '');

                // Safely broadcast the event
                safeApply(scope, function (scope) {
                    if (logic === "emit") {
                        scope.$emit(broadcastName, {
                            leafletEvent: e,
                            label: label,
                            markerName: markerName
                        });
                    } else if (logic === "broadcast") {
                        $rootScope.$broadcast(broadcastName, {
                            leafletEvent: e,
                            label: label,
                            markerName: markerName
                        });
                    }
                });
            };
        };

        var _getAvailableMarkerEvents = function () {
            return [
                'click',
                'dblclick',
                'mousedown',
                'mouseover',
                'mouseout',
                'contextmenu',
                'dragstart',
                'drag',
                'dragend',
                'move',
                'remove',
                'popupopen',
                'popupclose'
            ];
        };

        var _getAvailablePathEvents = function () {
            return [
                'click',
                'dblclick',
                'mousedown',
                'mouseover',
                'mouseout',
                'contextmenu',
                'add',
                'remove',
                'popupopen',
                'popupclose'
            ];
        };

        return {
            getAvailableMapEvents: function () {
                return [
                    'click',
                    'dblclick',
                    'mousedown',
                    'mouseup',
                    'mouseover',
                    'mouseout',
                    'mousemove',
                    'contextmenu',
                    'focus',
                    'blur',
                    'preclick',
                    'load',
                    'unload',
                    'viewreset',
                    'movestart',
                    'move',
                    'moveend',
                    'dragstart',
                    'drag',
                    'dragend',
                    'zoomstart',
                    'zoomend',
                    'zoomlevelschange',
                    'resize',
                    'autopanstart',
                    'layeradd',
                    'layerremove',
                    'baselayerchange',
                    'overlayadd',
                    'overlayremove',
                    'locationfound',
                    'locationerror',
                    'popupopen',
                    'popupclose',
                    'draw:created',
                    'draw:edited',
                    'draw:deleted',
                    'draw:drawstart',
                    'draw:drawstop',
                    'draw:editstart',
                    'draw:editstop',
                    'draw:deletestart',
                    'draw:deletestop'
                ];
            },

            genDispatchMapEvent: function (scope, eventName, logic) {
                return function (e) {
                    // Put together broadcast name
                    var broadcastName = 'leafletDirectiveMap.' + eventName;
                    // Safely broadcast the event
                    safeApply(scope, function (scope) {
                        if (logic === "emit") {
                            scope.$emit(broadcastName, {
                                leafletEvent: e
                            });
                        } else if (logic === "broadcast") {
                            $rootScope.$broadcast(broadcastName, {
                                leafletEvent: e
                            });
                        }
                    });
                };
            },

            getAvailableMarkerEvents: _getAvailableMarkerEvents,

            getAvailablePathEvents: _getAvailablePathEvents,

            notifyCenterChangedToBounds: function (scope) {
                scope.$broadcast("boundsChanged");
            },

            notifyCenterUrlHashChanged: function (scope, map, attrs, search) {
                if (!isDefined(attrs.urlHashCenter)) {
                    return;
                }
                var center = map.getCenter();
                var centerUrlHash = (center.lat).toFixed(4) + ":" + (center.lng).toFixed(4) + ":" + map.getZoom();
                if (!isDefined(search.c) || search.c !== centerUrlHash) {
                    //$log.debug("notified new center...");
                    scope.$emit("centerUrlHash", centerUrlHash);
                }
            },

            bindMarkerEvents: function (marker, name, markerData, leafletScope) {
                var markerEvents = [];
                var i;
                var eventName;
                var logic = "broadcast";

                if (!isDefined(leafletScope.eventBroadcast)) {
                    // Backward compatibility, if no event-broadcast attribute, all events are broadcasted
                    markerEvents = _getAvailableMarkerEvents();
                } else if (!isObject(leafletScope.eventBroadcast)) {
                    // Not a valid object
                    $log.error("[AngularJS - Leaflet] event-broadcast must be an object check your model.");
                } else {
                    // We have a possible valid object
                    if (!isDefined(leafletScope.eventBroadcast.marker)) {
                        // We do not have events enable/disable do we do nothing (all enabled by default)
                        markerEvents = _getAvailableMarkerEvents();
                    } else if (!isObject(leafletScope.eventBroadcast.marker)) {
                        // Not a valid object
                        $log.warn("[AngularJS - Leaflet] event-broadcast.marker must be an object check your model.");
                    } else {
                        // We have a possible valid map object
                        // Event propadation logic
                        if (leafletScope.eventBroadcast.marker.logic !== undefined && leafletScope.eventBroadcast.marker.logic !== null) {
                            // We take care of possible propagation logic
                            if (leafletScope.eventBroadcast.marker.logic !== "emit" && leafletScope.eventBroadcast.marker.logic !== "broadcast") {
                                // This is an error
                                $log.warn("[AngularJS - Leaflet] Available event propagation logic are: 'emit' or 'broadcast'.");
                            } else if (leafletScope.eventBroadcast.marker.logic === "emit") {
                                logic = "emit";
                            }
                        }
                        // Enable / Disable
                        var markerEventsEnable = false, markerEventsDisable = false;
                        if (leafletScope.eventBroadcast.marker.enable !== undefined && leafletScope.eventBroadcast.marker.enable !== null) {
                            if (typeof leafletScope.eventBroadcast.marker.enable === 'object') {
                                markerEventsEnable = true;
                            }
                        }
                        if (leafletScope.eventBroadcast.marker.disable !== undefined && leafletScope.eventBroadcast.marker.disable !== null) {
                            if (typeof leafletScope.eventBroadcast.marker.disable === 'object') {
                                markerEventsDisable = true;
                            }
                        }
                        if (markerEventsEnable && markerEventsDisable) {
                            // Both are active, this is an error
                            $log.warn("[AngularJS - Leaflet] can not enable and disable events at the same time");
                        } else if (!markerEventsEnable && !markerEventsDisable) {
                            // Both are inactive, this is an error
                            $log.warn("[AngularJS - Leaflet] must enable or disable events");
                        } else {
                            // At this point the marker object is OK, lets enable or disable events
                            if (markerEventsEnable) {
                                // Enable events
                                for (i = 0; i < leafletScope.eventBroadcast.marker.enable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.marker.enable[i];
                                    // Do we have already the event enabled?
                                    if (markerEvents.indexOf(eventName) !== -1) {
                                        // Repeated event, this is an error
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " is already enabled");
                                    } else {
                                        // Does the event exists?
                                        if (_getAvailableMarkerEvents().indexOf(eventName) === -1) {
                                            // The event does not exists, this is an error
                                            $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist");
                                        } else {
                                            // All ok enable the event
                                            markerEvents.push(eventName);
                                        }
                                    }
                                }
                            } else {
                                // Disable events
                                markerEvents = _getAvailableMarkerEvents();
                                for (i = 0; i < leafletScope.eventBroadcast.marker.disable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.marker.disable[i];
                                    var index = markerEvents.indexOf(eventName);
                                    if (index === -1) {
                                        // The event does not exist
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist or has been already disabled");

                                    } else {
                                        markerEvents.splice(index, 1);
                                    }
                                }
                            }
                        }
                    }
                }

                for (i = 0; i < markerEvents.length; i++) {
                    eventName = markerEvents[i];
                    marker.on(eventName, genDispatchMarkerEvent(eventName, logic, leafletScope, marker, name, markerData));
                }

                if (Helpers.LabelPlugin.isLoaded() && isDefined(marker.label)) {
                    genLabelEvents(leafletScope, logic, marker, name);
                }
            },

            bindPathEvents: function (path, name, pathData, leafletScope) {
                var pathEvents = [];
                var i;
                var eventName;
                var logic = "broadcast";

                if (!isDefined(leafletScope.eventBroadcast)) {
                    // Backward compatibility, if no event-broadcast attribute, all events are broadcasted
                    pathEvents = _getAvailablePathEvents();
                } else if (!isObject(leafletScope.eventBroadcast)) {
                    // Not a valid object
                    $log.error("[AngularJS - Leaflet] event-broadcast must be an object check your model.");
                } else {
                    // We have a possible valid object
                    if (!isDefined(leafletScope.eventBroadcast.path)) {
                        // We do not have events enable/disable do we do nothing (all enabled by default)
                        pathEvents = _getAvailablePathEvents();
                    } else if (isObject(leafletScope.eventBroadcast.paths)) {
                        // Not a valid object
                        $log.warn("[AngularJS - Leaflet] event-broadcast.path must be an object check your model.");
                    } else {
                        // We have a possible valid map object
                        // Event propadation logic
                        if (leafletScope.eventBroadcast.path.logic !== undefined && leafletScope.eventBroadcast.path.logic !== null) {
                            // We take care of possible propagation logic
                            if (leafletScope.eventBroadcast.path.logic !== "emit" && leafletScope.eventBroadcast.path.logic !== "broadcast") {
                                // This is an error
                                $log.warn("[AngularJS - Leaflet] Available event propagation logic are: 'emit' or 'broadcast'.");
                            } else if (leafletScope.eventBroadcast.path.logic === "emit") {
                                logic = "emit";
                            }
                        }
                        // Enable / Disable
                        var pathEventsEnable = false, pathEventsDisable = false;
                        if (leafletScope.eventBroadcast.path.enable !== undefined && leafletScope.eventBroadcast.path.enable !== null) {
                            if (typeof leafletScope.eventBroadcast.path.enable === 'object') {
                                pathEventsEnable = true;
                            }
                        }
                        if (leafletScope.eventBroadcast.path.disable !== undefined && leafletScope.eventBroadcast.path.disable !== null) {
                            if (typeof leafletScope.eventBroadcast.path.disable === 'object') {
                                pathEventsDisable = true;
                            }
                        }
                        if (pathEventsEnable && pathEventsDisable) {
                            // Both are active, this is an error
                            $log.warn("[AngularJS - Leaflet] can not enable and disable events at the same time");
                        } else if (!pathEventsEnable && !pathEventsDisable) {
                            // Both are inactive, this is an error
                            $log.warn("[AngularJS - Leaflet] must enable or disable events");
                        } else {
                            // At this point the path object is OK, lets enable or disable events
                            if (pathEventsEnable) {
                                // Enable events
                                for (i = 0; i < leafletScope.eventBroadcast.path.enable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.path.enable[i];
                                    // Do we have already the event enabled?
                                    if (pathEvents.indexOf(eventName) !== -1) {
                                        // Repeated event, this is an error
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " is already enabled");
                                    } else {
                                        // Does the event exists?
                                        if (_getAvailablePathEvents().indexOf(eventName) === -1) {
                                            // The event does not exists, this is an error
                                            $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist");
                                        } else {
                                            // All ok enable the event
                                            pathEvents.push(eventName);
                                        }
                                    }
                                }
                            } else {
                                // Disable events
                                pathEvents = _getAvailablePathEvents();
                                for (i = 0; i < leafletScope.eventBroadcast.path.disable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.path.disable[i];
                                    var index = pathEvents.indexOf(eventName);
                                    if (index === -1) {
                                        // The event does not exist
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist or has been already disabled");

                                    } else {
                                        pathEvents.splice(index, 1);
                                    }
                                }
                            }
                        }
                    }
                }

                for (i = 0; i < pathEvents.length; i++) {
                    eventName = pathEvents[i];
                    path.on(eventName, genDispatchPathEvent(eventName, logic, leafletScope, pathEvents, name));
                }

                if (Helpers.LabelPlugin.isLoaded() && isDefined(path.label)) {
                    genLabelEvents(leafletScope, logic, path, name);
                }
            }

        };
    }]);


    angular.module("leaflet-directive").factory('leafletLayerHelpers', ["$rootScope", "$log", "leafletHelpers", function ($rootScope, $log, leafletHelpers) {
        var Helpers = leafletHelpers,
            isString = leafletHelpers.isString,
            isObject = leafletHelpers.isObject,
            isDefined = leafletHelpers.isDefined;

        var utfGridCreateLayer = function (params) {
            if (!Helpers.UTFGridPlugin.isLoaded()) {
                $log.error('[AngularJS - Leaflet] The UTFGrid plugin is not loaded.');
                return;
            }
            var utfgrid = new L.UtfGrid(params.url, params.pluginOptions);

            utfgrid.on('mouseover', function (e) {
                $rootScope.$broadcast('leafletDirectiveMap.utfgridMouseover', e);
            });

            utfgrid.on('mouseout', function (e) {
                $rootScope.$broadcast('leafletDirectiveMap.utfgridMouseout', e);
            });

            utfgrid.on('click', function (e) {
                $rootScope.$broadcast('leafletDirectiveMap.utfgridClick', e);
            });

            return utfgrid;
        };

        var layerTypes = {
            xyz: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return L.tileLayer(params.url, params.options);
                }
            },
            mapbox: {
                mustHaveKey: true,
                createLayer: function (params) {
                    var url = '//{s}.tiles.mapbox.com/v3/' + params.key + '/{z}/{x}/{y}.png';
                    return L.tileLayer(url, params.options);
                }
            },
            geoJSON: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    if (!Helpers.GeoJSONPlugin.isLoaded()) {
                        return;
                    }
                    return new L.TileLayer.GeoJSON(params.url, params.pluginOptions, params.options);
                }
            },
            utfGrid: {
                mustHaveUrl: true,
                createLayer: utfGridCreateLayer
            },
            cartodbTiles: {
                mustHaveKey: true,
                createLayer: function (params) {
                    var url = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/{z}/{x}/{y}.png';
                    return L.tileLayer(url, params.options);
                }
            },
            cartodbUTFGrid: {
                mustHaveKey: true,
                mustHaveLayer: true,
                createLayer: function (params) {
                    params.url = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/' + params.layer + '/{z}/{x}/{y}.grid.json';
                    return utfGridCreateLayer(params);
                }
            },
            cartodbInteractive: {
                mustHaveKey: true,
                mustHaveLayer: true,
                createLayer: function (params) {
                    var tilesURL = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/{z}/{x}/{y}.png';
                    var tileLayer = L.tileLayer(tilesURL, params.options);
                    params.url = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/' + params.layer + '/{z}/{x}/{y}.grid.json';
                    var utfLayer = utfGridCreateLayer(params);
                    return L.layerGroup([tileLayer, utfLayer]);
                }
            },
            wms: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return L.tileLayer.wms(params.url, params.options);
                }
            },
            wmts: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return L.tileLayer.wmts(params.url, params.options);
                }
            },
            wfs: {
                mustHaveUrl: true,
                mustHaveLayer: true,
                createLayer: function (params) {
                    if (!Helpers.WFSLayerPlugin.isLoaded()) {
                        return;
                    }
                    var options = angular.copy(params.options);
                    if (options.crs && 'string' === typeof options.crs) {
                        /*jshint -W061 */
                        options.crs = eval(options.crs);
                    }
                    return new L.GeoJSON.WFS(params.url, params.layer, options);
                }
            },
            group: {
                mustHaveUrl: false,
                createLayer: function () {
                    return L.layerGroup();
                }
            },
            featureGroup: {
                mustHaveUrl: false,
                createLayer: function () {
                    return L.featureGroup();
                }
            },
            google: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    var type = params.type || 'SATELLITE';
                    if (!Helpers.GoogleLayerPlugin.isLoaded()) {
                        return;
                    }
                    return new L.Google(type, params.options);
                }
            },
            china: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    var type = params.type || '';
                    if (!Helpers.ChinaLayerPlugin.isLoaded()) {
                        return;
                    }
                    return L.tileLayer.chinaProvider(type, params.options);
                }
            },
            ags: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    if (!Helpers.AGSLayerPlugin.isLoaded()) {
                        return;
                    }

                    var options = angular.copy(params.options);
                    angular.extend(options, {
                        url: params.url
                    });
                    var layer = new lvector.AGS(options);
                    layer.onAdd = function (map) {
                        this.setMap(map);
                    };
                    layer.onRemove = function () {
                        this.setMap(null);
                    };
                    return layer;
                }
            },
            dynamic: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    if (!Helpers.DynamicMapLayerPlugin.isLoaded()) {
                        return;
                    }
                    return L.esri.dynamicMapLayer(params.url, params.options);
                }
            },
            markercluster: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    if (!Helpers.MarkerClusterPlugin.isLoaded()) {
                        $log.error('[AngularJS - Leaflet] The markercluster plugin is not loaded.');
                        return;
                    }
                    return new L.MarkerClusterGroup(params.options);
                }
            },
            bing: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    if (!Helpers.BingLayerPlugin.isLoaded()) {
                        return;
                    }
                    return new L.BingLayer(params.key, params.options);
                }
            },
            heatmap: {
                mustHaveUrl: false,
                mustHaveData: true,
                createLayer: function (params) {
                    if (!Helpers.HeatMapLayerPlugin.isLoaded()) {
                        return;
                    }
                    var layer = new L.TileLayer.WebGLHeatMap(params.options);
                    if (isDefined(params.data)) {
                        layer.setData(params.data);
                    }

                    return layer;
                }
            },
            yandex: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    var type = params.type || 'map';
                    if (!Helpers.YandexLayerPlugin.isLoaded()) {
                        return;
                    }
                    return new L.Yandex(type, params.options);
                }
            },
            imageOverlay: {
                mustHaveUrl: true,
                mustHaveBounds: true,
                createLayer: function (params) {
                    return L.imageOverlay(params.url, params.bounds, params.options);
                }
            },

            // This "custom" type is used to accept every layer that user want to define himself.
            // We can wrap these custom layers like heatmap or yandex, but it means a lot of work/code to wrap the world,
            // so we let user to define their own layer outside the directive,
            // and pass it on "createLayer" result for next processes
            custom: {
                createLayer: function (params) {
                    if (params.layer instanceof L.Class) {
                        return angular.copy(params.layer);
                    }
                    else {
                        $log.error('[AngularJS - Leaflet] A custom layer must be a leaflet Class');
                    }
                }
            },
            cartodb: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return cartodb.createLayer(params.map, params.url);
                }
            }
        };

        function isValidLayerType(layerDefinition) {
            // Check if the baselayer has a valid type
            if (!isString(layerDefinition.type)) {
                $log.error('[AngularJS - Leaflet] A layer must have a valid type defined.');
                return false;
            }

            if (Object.keys(layerTypes).indexOf(layerDefinition.type) === -1) {
                $log.error('[AngularJS - Leaflet] A layer must have a valid type: ' + Object.keys(layerTypes));
                return false;
            }

            // Check if the layer must have an URL
            if (layerTypes[layerDefinition.type].mustHaveUrl && !isString(layerDefinition.url)) {
                $log.error('[AngularJS - Leaflet] A base layer must have an url');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveData && !isDefined(layerDefinition.data)) {
                $log.error('[AngularJS - Leaflet] The base layer must have a "data" array attribute');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveLayer && !isDefined(layerDefinition.layer)) {
                $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have an layer defined');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveBounds && !isDefined(layerDefinition.bounds)) {
                $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have bounds defined');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveKey && !isDefined(layerDefinition.key)) {
                $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have key defined');
                return false;
            }
            return true;
        }

        return {
            createLayer: function (layerDefinition) {
                if (!isValidLayerType(layerDefinition)) {
                    return;
                }

                if (!isString(layerDefinition.name)) {
                    $log.error('[AngularJS - Leaflet] A base layer must have a name');
                    return;
                }
                if (!isObject(layerDefinition.layerParams)) {
                    layerDefinition.layerParams = {};
                }
                if (!isObject(layerDefinition.layerOptions)) {
                    layerDefinition.layerOptions = {};
                }

                // Mix the layer specific parameters with the general Leaflet options. Although this is an overhead
                // the definition of a base layers is more 'clean' if the two types of parameters are differentiated
                for (var attrname in layerDefinition.layerParams) {
                    layerDefinition.layerOptions[attrname] = layerDefinition.layerParams[attrname];
                }

                var params = {
                    url: layerDefinition.url,
                    data: layerDefinition.data,
                    options: layerDefinition.layerOptions,
                    layer: layerDefinition.layer,
                    type: layerDefinition.layerType,
                    bounds: layerDefinition.bounds,
                    key: layerDefinition.key,
                    pluginOptions: layerDefinition.pluginOptions,
                    user: layerDefinition.user
                };

                //TODO Add $watch to the layer properties
                return layerTypes[layerDefinition.type].createLayer(params);
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletControlHelpers', ["$rootScope", "$log", "leafletHelpers", "leafletMapDefaults", function ($rootScope, $log, leafletHelpers, leafletMapDefaults) {
        var isObject = leafletHelpers.isObject,
            isDefined = leafletHelpers.isDefined;
        var _layersControl;

        var _controlLayersMustBeVisible = function (baselayers, overlays, mapId) {
            var defaults = leafletMapDefaults.getDefaults(mapId);
            if (!defaults.controls.layers.visible) {
                return false;
            }

            var numberOfLayers = 0;
            if (isObject(baselayers)) {
                numberOfLayers += Object.keys(baselayers).length;
            }
            if (isObject(overlays)) {
                numberOfLayers += Object.keys(overlays).length;
            }
            return numberOfLayers > 1;
        };

        var _createLayersControl = function (mapId) {
            var defaults = leafletMapDefaults.getDefaults(mapId);
            var controlOptions = {
                collapsed: defaults.controls.layers.collapsed,
                position: defaults.controls.layers.position
            };

            angular.extend(controlOptions, defaults.controls.layers.options);

            var control;
            if (defaults.controls.layers && isDefined(defaults.controls.layers.control)) {
                control = defaults.controls.layers.control.apply(this, [
                    [],
                    [],
                    controlOptions
                ]);
            } else {
                control = new L.control.layers([], [], controlOptions);
            }

            return control;
        };

        return {
            layersControlMustBeVisible: _controlLayersMustBeVisible,

            updateLayersControl: function (map, mapId, loaded, baselayers, overlays, leafletLayers) {
                var i;

                var mustBeLoaded = _controlLayersMustBeVisible(baselayers, overlays, mapId);
                if (isDefined(_layersControl) && loaded) {
                    for (i in leafletLayers.baselayers) {
                        _layersControl.removeLayer(leafletLayers.baselayers[i]);
                    }
                    for (i in leafletLayers.overlays) {
                        _layersControl.removeLayer(leafletLayers.overlays[i]);
                    }
                    _layersControl.removeFrom(map);
                }

                if (mustBeLoaded) {
                    _layersControl = _createLayersControl(mapId);
                    for (i in baselayers) {
                        if (isDefined(leafletLayers.baselayers[i])) {
                            _layersControl.addBaseLayer(leafletLayers.baselayers[i], baselayers[i].name);
                        }
                    }
                    for (i in overlays) {
                        if (isDefined(leafletLayers.overlays[i])) {
                            _layersControl.addOverlay(leafletLayers.overlays[i], overlays[i].name);
                        }
                    }
                    _layersControl.addTo(map);
                }
                return mustBeLoaded;
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletLegendHelpers', function () {
        var _updateArcGISLegend = function (div, legendData) {
            div.innerHTML = '';
            if (legendData.error) {
                div.innerHTML += '<div class="info-title alert alert-danger">' + legendData.error.message + '</div>';
            } else {
                for (var i = 0; i < legendData.layers.length; i++) {
                    var layer = legendData.layers[i];
                    div.innerHTML += '<div class="info-title" data-layerid="' + layer.layerId + '">' + layer.layerName + '</div>';
                    for (var j = 0; j < layer.legend.length; j++) {
                        var leg = layer.legend[j];
                        div.innerHTML +=
                            '<div class="inline" data-layerid="' + layer.layerId + '"><img src="data:' + leg.contentType + ';base64,' + leg.imageData + '" /></div>' +
                            '<div class="info-label" data-layerid="' + layer.layerId + '">' + leg.label + '</div>';
                    }
                }
            }
        };

        var _getOnAddArcGISLegend = function (legendData, legendClass) {
            return function (/*map*/) {
                var div = L.DomUtil.create('div', legendClass);

                if (!L.Browser.touch) {
                    L.DomEvent.disableClickPropagation(div);
                    L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
                } else {
                    L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
                }
                _updateArcGISLegend(div, legendData);
                return div;
            };
        };

        var _getOnAddArrayLegend = function (legend, legendClass) {
            return function (/*map*/) {
                var div = L.DomUtil.create('div', legendClass);
                for (var i = 0; i < legend.colors.length; i++) {
                    div.innerHTML +=
                        '<div class="outline"><i style="background:' + legend.colors[i] + '"></i></div>' +
                        '<div class="info-label">' + legend.labels[i] + '</div>';
                }
                if (!L.Browser.touch) {
                    L.DomEvent.disableClickPropagation(div);
                    L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
                } else {
                    L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
                }
                return div;
            };
        };

        return {
            getOnAddArcGISLegend: _getOnAddArcGISLegend,
            getOnAddArrayLegend: _getOnAddArrayLegend,
            updateArcGISLegend: _updateArcGISLegend,
        };
    });

    angular.module("leaflet-directive").factory('leafletPathsHelpers', ["$rootScope", "$log", "leafletHelpers", function ($rootScope, $log, leafletHelpers) {
        var isDefined = leafletHelpers.isDefined,
            isArray = leafletHelpers.isArray,
            isNumber = leafletHelpers.isNumber,
            isValidPoint = leafletHelpers.isValidPoint;
        var availableOptions = [
            // Path options
            'stroke', 'weight', 'color', 'opacity',
            'fill', 'fillColor', 'fillOpacity',
            'dashArray', 'lineCap', 'lineJoin', 'clickable',
            'pointerEvents', 'className',

            // Polyline options
            'smoothFactor', 'noClip'
        ];

        function _convertToLeafletLatLngs(latlngs) {
            return latlngs.filter(function (latlng) {
                return isValidPoint(latlng);
            }).map(function (latlng) {
                return new L.LatLng(latlng.lat, latlng.lng);
            });
        }

        function _convertToLeafletLatLng(latlng) {
            return new L.LatLng(latlng.lat, latlng.lng);
        }

        function _convertToLeafletMultiLatLngs(paths) {
            return paths.map(function (latlngs) {
                return _convertToLeafletLatLngs(latlngs);
            });
        }

        function _getOptions(path, defaults) {
            var options = {};
            for (var i = 0; i < availableOptions.length; i++) {
                var optionName = availableOptions[i];

                if (isDefined(path[optionName])) {
                    options[optionName] = path[optionName];
                } else if (isDefined(defaults.path[optionName])) {
                    options[optionName] = defaults.path[optionName];
                }
            }

            return options;
        }

        var _updatePathOptions = function (path, data) {
            var updatedStyle = {};
            for (var i = 0; i < availableOptions.length; i++) {
                var optionName = availableOptions[i];
                if (isDefined(data[optionName])) {
                    updatedStyle[optionName] = data[optionName];
                }
            }
            path.setStyle(data);
        };

        var _isValidPolyline = function (latlngs) {
            if (!isArray(latlngs)) {
                return false;
            }
            for (var i = 0; i < latlngs.length; i++) {
                var point = latlngs[i];
                if (!isValidPoint(point)) {
                    return false;
                }
            }
            return true;
        };

        var pathTypes = {
            polyline: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;
                    return _isValidPolyline(latlngs);
                },
                createPath: function (options) {
                    return new L.Polyline([], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            multiPolyline: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;
                    if (!isArray(latlngs)) {
                        return false;
                    }

                    for (var i in latlngs) {
                        var polyline = latlngs[i];
                        if (!_isValidPolyline(polyline)) {
                            return false;
                        }
                    }

                    return true;
                },
                createPath: function (options) {
                    return new L.multiPolyline([
                        [
                            [0, 0],
                            [1, 1]
                        ]
                    ], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletMultiLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            polygon: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;
                    return _isValidPolyline(latlngs);
                },
                createPath: function (options) {
                    return new L.Polygon([], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            multiPolygon: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;

                    if (!isArray(latlngs)) {
                        return false;
                    }

                    for (var i in latlngs) {
                        var polyline = latlngs[i];
                        if (!_isValidPolyline(polyline)) {
                            return false;
                        }
                    }

                    return true;
                },
                createPath: function (options) {
                    return new L.MultiPolygon([
                        [
                            [0, 0],
                            [1, 1],
                            [0, 1]
                        ]
                    ], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletMultiLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            rectangle: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;

                    if (!isArray(latlngs) || latlngs.length !== 2) {
                        return false;
                    }

                    for (var i in latlngs) {
                        var point = latlngs[i];
                        if (!isValidPoint(point)) {
                            return false;
                        }
                    }

                    return true;
                },
                createPath: function (options) {
                    return new L.Rectangle([
                        [0, 0],
                        [1, 1]
                    ], options);
                },
                setPath: function (path, data) {
                    path.setBounds(new L.LatLngBounds(_convertToLeafletLatLngs(data.latlngs)));
                    _updatePathOptions(path, data);
                }
            },
            circle: {
                isValid: function (pathData) {
                    var point = pathData.latlngs;
                    return isValidPoint(point) && isNumber(pathData.radius);
                },
                createPath: function (options) {
                    return new L.Circle([0, 0], 1, options);
                },
                setPath: function (path, data) {
                    path.setLatLng(_convertToLeafletLatLng(data.latlngs));
                    if (isDefined(data.radius)) {
                        path.setRadius(data.radius);
                    }
                    _updatePathOptions(path, data);
                }
            },
            circleMarker: {
                isValid: function (pathData) {
                    var point = pathData.latlngs;
                    return isValidPoint(point) && isNumber(pathData.radius);
                },
                createPath: function (options) {
                    return new L.CircleMarker([0, 0], options);
                },
                setPath: function (path, data) {
                    path.setLatLng(_convertToLeafletLatLng(data.latlngs));
                    if (isDefined(data.radius)) {
                        path.setRadius(data.radius);
                    }
                    _updatePathOptions(path, data);
                }
            }
        };

        var _getPathData = function (path) {
            var pathData = {};
            if (path.latlngs) {
                pathData.latlngs = path.latlngs;
            }

            if (path.radius) {
                pathData.radius = path.radius;
            }

            return pathData;
        };

        return {
            setPathOptions: function (leafletPath, pathType, data) {
                if (!isDefined(pathType)) {
                    pathType = "polyline";
                }
                pathTypes[pathType].setPath(leafletPath, data);
            },
            createPath: function (name, path, defaults) {
                if (!isDefined(path.type)) {
                    path.type = "polyline";
                }
                var options = _getOptions(path, defaults);
                var pathData = _getPathData(path);

                if (!pathTypes[path.type].isValid(pathData)) {
                    $log.error("[AngularJS - Leaflet] Invalid data passed to the " + path.type + " path");
                    return;
                }

                return pathTypes[path.type].createPath(options);
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletBoundsHelpers', ["$log", "leafletHelpers", function ($log, leafletHelpers) {

        var isArray = leafletHelpers.isArray,
            isNumber = leafletHelpers.isNumber;

        function _isValidBounds(bounds) {
            return angular.isDefined(bounds) && angular.isDefined(bounds.southWest) &&
                angular.isDefined(bounds.northEast) && angular.isNumber(bounds.southWest.lat) &&
                angular.isNumber(bounds.southWest.lng) && angular.isNumber(bounds.northEast.lat) &&
                angular.isNumber(bounds.northEast.lng);
        }

        return {
            createLeafletBounds: function (bounds) {
                if (_isValidBounds(bounds)) {
                    return L.latLngBounds([bounds.southWest.lat, bounds.southWest.lng],
                        [bounds.northEast.lat, bounds.northEast.lng ]);
                }
            },

            isValidBounds: _isValidBounds,

            createBoundsFromArray: function (boundsArray) {
                if (!(isArray(boundsArray) && boundsArray.length === 2 &&
                    isArray(boundsArray[0]) && isArray(boundsArray[1]) &&
                    boundsArray[0].length === 2 && boundsArray[1].length === 2 &&
                    isNumber(boundsArray[0][0]) && isNumber(boundsArray[0][1]) &&
                    isNumber(boundsArray[1][0]) && isNumber(boundsArray[1][1]))) {
                    $log.error("[AngularJS - Leaflet] The bounds array is not valid.");
                    return;
                }

                return {
                    northEast: {
                        lat: boundsArray[0][0],
                        lng: boundsArray[0][1]
                    },
                    southWest: {
                        lat: boundsArray[1][0],
                        lng: boundsArray[1][1]
                    }
                };

            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletMarkersHelpers', ["$rootScope", "leafletHelpers", "$log", function ($rootScope, leafletHelpers, $log) {

        var isDefined = leafletHelpers.isDefined,
            MarkerClusterPlugin = leafletHelpers.MarkerClusterPlugin,
            AwesomeMarkersPlugin = leafletHelpers.AwesomeMarkersPlugin,
            MakiMarkersPlugin = leafletHelpers.MakiMarkersPlugin,
            safeApply = leafletHelpers.safeApply,
            Helpers = leafletHelpers,
            isString = leafletHelpers.isString,
            isNumber = leafletHelpers.isNumber,
            isObject = leafletHelpers.isObject,
            groups = {};

        var createLeafletIcon = function (iconData) {
            if (isDefined(iconData) && isDefined(iconData.type) && iconData.type === 'awesomeMarker') {
                if (!AwesomeMarkersPlugin.isLoaded()) {
                    $log.error('[AngularJS - Leaflet] The AwesomeMarkers Plugin is not loaded.');
                }

                return new L.AwesomeMarkers.icon(iconData);
            }

            if (isDefined(iconData) && isDefined(iconData.type) && iconData.type === 'makiMarker') {
                if (!MakiMarkersPlugin.isLoaded()) {
                    $log.error('[AngularJS - Leaflet] The MakiMarkers Plugin is not loaded.');
                }

                return new L.MakiMarkers.icon(iconData);
            }

            if (isDefined(iconData) && isDefined(iconData.type) && iconData.type === 'div') {
                return new L.divIcon(iconData);
            }

            var base64icon = "data:image/png;base64,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";

            var base64shadow = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAYAAACoYAD2AAAC5ElEQVRYw+2YW4/TMBCF45S0S1luXZCABy5CgLQgwf//S4BYBLTdJLax0fFqmB07nnQfEGqkIydpVH85M+NLjPe++dcPc4Q8Qh4hj5D/AaQJx6H/4TMwB0PeBNwU7EGQAmAtsNfAzoZkgIa0ZgLMa4Aj6CxIAsjhjOCoL5z7Glg1JAOkaicgvQBXuncwJAWjksLtBTWZe04CnYRktUGdilALppZBOgHGZcBzL6OClABvMSVIzyBjazOgrvACf1ydC5mguqAVg6RhdkSWQFj2uxfaq/BrIZOLEWgZdALIDvcMcZLD8ZbLC9de4yR1sYMi4G20S4Q/PWeJYxTOZn5zJXANZHIxAd4JWhPIloTJZhzMQduM89WQ3MUVAE/RnhAXpTycqys3NZALOBbB7kFrgLesQl2h45Fcj8L1tTSohUwuxhy8H/Qg6K7gIs+3kkaigQCOcyEXCHN07wyQazhrmIulvKMQAwMcmLNqyCVyMAI+BuxSMeTk3OPikLY2J1uE+VHQk6ANrhds+tNARqBeaGc72cK550FP4WhXmFmcMGhTwAR1ifOe3EvPqIegFmF+C8gVy0OfAaWQPMR7gF1OQKqGoBjq90HPMP01BUjPOqGFksC4emE48tWQAH0YmvOgF3DST6xieJgHAWxPAHMuNhrImIdvoNOKNWIOcE+UXE0pYAnkX6uhWsgVXDxHdTfCmrEEmMB2zMFimLVOtiiajxiGWrbU52EeCdyOwPEQD8LqyPH9Ti2kgYMf4OhSKB7qYILbBv3CuVTJ11Y80oaseiMWOONc/Y7kJYe0xL2f0BaiFTxknHO5HaMGMublKwxFGzYdWsBF174H/QDknhTHmHHN39iWFnkZx8lPyM8WHfYELmlLKtgWNmFNzQcC1b47gJ4hL19i7o65dhH0Negbca8vONZoP7doIeOC9zXm8RjuL0Gf4d4OYaU5ljo3GYiqzrWQHfJxA6ALhDpVKv9qYeZA8eM3EhfPSCmpuD0AAAAASUVORK5CYII=";

            if (!isDefined(iconData)) {
                return new L.Icon.Default({
                    iconUrl: base64icon,
                    shadowUrl: base64shadow
                });
            }

            if (!isDefined(iconData.iconUrl)) {
                iconData.iconUrl = base64icon;
                iconData.shadowUrl = base64shadow;
            }
            return new L.Icon(iconData);
        };

        var _resetMarkerGroup = function (groupName) {
            if (isDefined(groups[groupName])) {
                groups.splice(groupName, 1);
            }
        };

        var _resetMarkerGroups = function () {
            groups = {};
        };

        var _deleteMarker = function (marker, map, layers) {
            marker.closePopup();
            // There is no easy way to know if a marker is added to a layer, so we search for it
            // if there are overlays
            if (isDefined(layers) && isDefined(layers.overlays)) {
                for (var key in layers.overlays) {
                    if (layers.overlays[key] instanceof L.LayerGroup || layers.overlays[key] instanceof L.FeatureGroup) {
                        if (layers.overlays[key].hasLayer(marker)) {
                            layers.overlays[key].removeLayer(marker);
                            return;
                        }
                    }
                }
            }

            if (isDefined(groups)) {
                for (var groupKey in groups) {
                    if (groups[groupKey].hasLayer(marker)) {
                        groups[groupKey].removeLayer(marker);
                    }
                }
            }

            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        };

        return {
            resetMarkerGroup: _resetMarkerGroup,

            resetMarkerGroups: _resetMarkerGroups,

            deleteMarker: _deleteMarker,

            createMarker: function (markerData) {
                if (!isDefined(markerData)) {
                    $log.error('[AngularJS - Leaflet] The marker definition is not valid.');
                    return;
                }

                var markerOptions = {
                    icon: createLeafletIcon(markerData.icon),
                    title: isDefined(markerData.title) ? markerData.title : '',
                    draggable: isDefined(markerData.draggable) ? markerData.draggable : false,
                    clickable: isDefined(markerData.clickable) ? markerData.clickable : true,
                    riseOnHover: isDefined(markerData.riseOnHover) ? markerData.riseOnHover : false,
                    zIndexOffset: isDefined(markerData.zIndexOffset) ? markerData.zIndexOffset : 0,
                    iconAngle: isDefined(markerData.iconAngle) ? markerData.iconAngle : 0
                };
                // Add any other options not added above to markerOptions
                for (var markerDatum in markerData) {
                    if (markerData.hasOwnProperty(markerDatum) && !markerOptions.hasOwnProperty(markerDatum)) {
                        markerOptions[markerDatum] = markerData[markerDatum];
                    }
                }

                var marker = new L.marker(markerData, markerOptions);

                if (!isString(markerData.message)) {
                    marker.unbindPopup();
                }

                return marker;
            },

            addMarkerToGroup: function (marker, groupName, groupOptions, map) {
                if (!isString(groupName)) {
                    $log.error('[AngularJS - Leaflet] The marker group you have specified is invalid.');
                    return;
                }

                if (!MarkerClusterPlugin.isLoaded()) {
                    $log.error("[AngularJS - Leaflet] The MarkerCluster plugin is not loaded.");
                    return;
                }
                if (!isDefined(groups[groupName])) {
                    groups[groupName] = new L.MarkerClusterGroup(groupOptions);
                    map.addLayer(groups[groupName]);
                }
                groups[groupName].addLayer(marker);
            },

            listenMarkerEvents: function (marker, markerData, leafletScope) {
                marker.on("popupopen", function (/* event */) {
                    safeApply(leafletScope, function () {
                        markerData.focus = true;
                    });
                });
                marker.on("popupclose", function (/* event */) {
                    safeApply(leafletScope, function () {
                        markerData.focus = false;
                    });
                });
            },

            addMarkerWatcher: function (marker, name, leafletScope, layers, map) {
                var clearWatch = leafletScope.$watch("markers." + name, function (markerData, oldMarkerData) {
                    if (!isDefined(markerData)) {
                        _deleteMarker(marker, map, layers);
                        clearWatch();
                        return;
                    }

                    if (!isDefined(oldMarkerData)) {
                        return;
                    }

                    // Update the lat-lng property (always present in marker properties)
                    if (!(isNumber(markerData.lat) && isNumber(markerData.lng))) {
                        $log.warn('There are problems with lat-lng data, please verify your marker model');
                        _deleteMarker(marker, map, layers);
                        return;
                    }

                    // It is possible that the layer has been removed or the layer marker does not exist
                    // Update the layer group if present or move it to the map if not
                    if (!isString(markerData.layer)) {
                        // There is no layer information, we move the marker to the map if it was in a layer group
                        if (isString(oldMarkerData.layer)) {
                            // Remove from the layer group that is supposed to be
                            if (isDefined(layers.overlays[oldMarkerData.layer]) && layers.overlays[oldMarkerData.layer].hasLayer(marker)) {
                                layers.overlays[oldMarkerData.layer].removeLayer(marker);
                                marker.closePopup();
                            }
                            // Test if it is not on the map and add it
                            if (!map.hasLayer(marker)) {
                                map.addLayer(marker);
                            }
                        }
                    }

                    if (isString(markerData.layer) && oldMarkerData.layer !== markerData.layer) {
                        // If it was on a layer group we have to remove it
                        if (isString(oldMarkerData.layer) && isDefined(layers.overlays[oldMarkerData.layer]) && layers.overlays[oldMarkerData.layer].hasLayer(marker)) {
                            layers.overlays[oldMarkerData.layer].removeLayer(marker);
                        }
                        marker.closePopup();

                        // Remove it from the map in case the new layer is hidden or there is an error in the new layer
                        if (map.hasLayer(marker)) {
                            map.removeLayer(marker);
                        }

                        // The markerData.layer is defined so we add the marker to the layer if it is different from the old data
                        if (!isDefined(layers.overlays[markerData.layer])) {
                            $log.error('[AngularJS - Leaflet] You must use a name of an existing layer');
                            return;
                        }
                        // Is a group layer?
                        var layerGroup = layers.overlays[markerData.layer];
                        if (!(layerGroup instanceof L.LayerGroup || layerGroup instanceof L.FeatureGroup)) {
                            $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group" or "featureGroup"');
                            return;
                        }
                        // The marker goes to a correct layer group, so first of all we add it
                        layerGroup.addLayer(marker);
                        // The marker is automatically added to the map depending on the visibility
                        // of the layer, so we only have to open the popup if the marker is in the map
                        if (map.hasLayer(marker) && markerData.focus === true) {
                            marker.openPopup();
                        }
                    }

                    // Update the draggable property
                    if (markerData.draggable !== true && oldMarkerData.draggable === true && (isDefined(marker.dragging))) {
                        marker.dragging.disable();
                    }

                    if (markerData.draggable === true && oldMarkerData.draggable !== true) {
                        // The markerData.draggable property must be true so we update if there wasn't a previous value or it wasn't true
                        if (marker.dragging) {
                            marker.dragging.enable();
                        } else {
                            if (L.Handler.MarkerDrag) {
                                marker.dragging = new L.Handler.MarkerDrag(marker);
                                marker.options.draggable = true;
                                marker.dragging.enable();
                            }
                        }
                    }

                    // Update the icon property
                    if (!isObject(markerData.icon)) {
                        // If there is no icon property or it's not an object
                        if (isObject(oldMarkerData.icon)) {
                            // If there was an icon before restore to the default
                            marker.setIcon(createLeafletIcon());
                            marker.closePopup();
                            marker.unbindPopup();
                            if (isString(markerData.message)) {
                                marker.bindPopup(markerData.message, markerData.popupOptions);
                            }
                        }
                    }

                    if (isObject(markerData.icon) && isObject(oldMarkerData.icon) && !angular.equals(markerData.icon, oldMarkerData.icon)) {
                        var dragG = false;
                        if (marker.dragging) {
                            dragG = marker.dragging.enabled();
                        }
                        marker.setIcon(createLeafletIcon(markerData.icon));
                        if (dragG) {
                            marker.dragging.enable();
                        }
                        marker.closePopup();
                        marker.unbindPopup();
                        if (isString(markerData.message)) {
                            marker.bindPopup(markerData.message, markerData.popupOptions);
                        }
                    }

                    // Update the Popup message property
                    if (!isString(markerData.message) && isString(oldMarkerData.message)) {
                        marker.closePopup();
                        marker.unbindPopup();
                    }

                    // Update the label content
                    if (Helpers.LabelPlugin.isLoaded() && isDefined(markerData.label) && isDefined(markerData.label.message) && !angular.equals(markerData.label.message, oldMarkerData.label.message)) {
                        marker.updateLabelContent(markerData.label.message);
                    }

                    // There is some text in the popup, so we must show the text or update existing
                    if (isString(markerData.message) && !isString(oldMarkerData.message)) {
                        // There was no message before so we create it
                        marker.bindPopup(markerData.message, markerData.popupOptions);
                        if (markerData.focus === true) {
                            // If the focus is set, we must open the popup, because we do not know if it was opened before
                            marker.openPopup();
                        }
                    }

                    if (isString(markerData.message) && isString(oldMarkerData.message) && markerData.message !== oldMarkerData.message) {
                        // There was a different previous message so we update it
                        marker.setPopupContent(markerData.message);
                    }

                    // Update the focus property
                    var updatedFocus = false;
                    if (markerData.focus !== true && oldMarkerData.focus === true) {
                        // If there was a focus property and was true we turn it off
                        marker.closePopup();
                        updatedFocus = true;
                    }

                    // The markerData.focus property must be true so we update if there wasn't a previous value or it wasn't true
                    if (markerData.focus === true && oldMarkerData.focus !== true) {
                        marker.openPopup();
                        updatedFocus = true;
                    }

                    if (oldMarkerData.focus === true && markerData.focus === true) {
                        // Reopen the popup when focus is still true
                        marker.openPopup();
                        updatedFocus = true;
                    }

                    // zIndexOffset adjustment
                    if (oldMarkerData.zIndexOffset !== markerData.zIndexOffset) {
                        marker.setZIndexOffset(markerData.zIndexOffset);
                    }

                    var markerLatLng = marker.getLatLng();
                    var isCluster = (isString(markerData.layer) && Helpers.MarkerClusterPlugin.is(layers.overlays[markerData.layer]));
                    // If the marker is in a cluster it has to be removed and added to the layer when the location is changed
                    if (isCluster) {
                        // The focus has changed even by a user click or programatically
                        if (updatedFocus) {
                            // We only have to update the location if it was changed programatically, because it was
                            // changed by a user drag the marker data has already been updated by the internal event
                            // listened by the directive
                            if ((markerData.lat !== oldMarkerData.lat) || (markerData.lng !== oldMarkerData.lng)) {
                                layers.overlays[markerData.layer].removeLayer(marker);
                                marker.setLatLng([markerData.lat, markerData.lng]);
                                layers.overlays[markerData.layer].addLayer(marker);
                            }
                        } else {
                            // The marker has possibly moved. It can be moved by a user drag (marker location and data are equal but old
                            // data is diferent) or programatically (marker location and data are diferent)
                            if ((markerLatLng.lat !== markerData.lat) || (markerLatLng.lng !== markerData.lng)) {
                                // The marker was moved by a user drag
                                layers.overlays[markerData.layer].removeLayer(marker);
                                marker.setLatLng([markerData.lat, markerData.lng]);
                                layers.overlays[markerData.layer].addLayer(marker);
                            } else if ((markerData.lat !== oldMarkerData.lat) || (markerData.lng !== oldMarkerData.lng)) {
                                // The marker was moved programatically
                                layers.overlays[markerData.layer].removeLayer(marker);
                                marker.setLatLng([markerData.lat, markerData.lng]);
                                layers.overlays[markerData.layer].addLayer(marker);
                            }
                        }
                    } else if (markerLatLng.lat !== markerData.lat || markerLatLng.lng !== markerData.lng) {
                        marker.setLatLng([markerData.lat, markerData.lng]);
                    }
                }, true);
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletHelpers', ["$q", "$log", function ($q, $log) {

        function _obtainEffectiveMapId(d, mapId) {
            var id, i;
            if (!angular.isDefined(mapId)) {
                if (Object.keys(d).length === 0) {
                    id = "main";
                } else if (Object.keys(d).length >= 1) {
                    for (i in d) {
                        if (d.hasOwnProperty(i)) {
                            id = i;
                        }
                    }
                } else if (Object.keys(d).length === 0) {
                    id = "main";
                } else {
                    $log.error("[AngularJS - Leaflet] - You have more than 1 map on the DOM, you must provide the map ID to the leafletData.getXXX call");
                }
            } else {
                id = mapId;
            }

            return id;
        }

        function _getUnresolvedDefer(d, mapId) {
            var id = _obtainEffectiveMapId(d, mapId),
                defer;

            if (!angular.isDefined(d[id]) || d[id].resolvedDefer === true) {
                defer = $q.defer();
                d[id] = {
                    defer: defer,
                    resolvedDefer: false
                };
            } else {
                defer = d[id].defer;
            }

            return defer;
        }

        return {
            //Determine if a reference is {}
            isEmpty: function (value) {
                return Object.keys(value).length === 0;
            },

            //Determine if a reference is undefined or {}
            isUndefinedOrEmpty: function (value) {
                return (angular.isUndefined(value) || value === null) || Object.keys(value).length === 0;
            },

            // Determine if a reference is defined
            isDefined: function (value) {
                return angular.isDefined(value) && value !== null;
            },

            // Determine if a reference is a number
            isNumber: function (value) {
                return angular.isNumber(value);
            },

            // Determine if a reference is a string
            isString: function (value) {
                return angular.isString(value);
            },

            // Determine if a reference is an array
            isArray: function (value) {
                return angular.isArray(value);
            },

            // Determine if a reference is an object
            isObject: function (value) {
                return angular.isObject(value);
            },

            // Determine if a reference is a function.
            isFunction: function (value) {
                return angular.isFunction(value);
            },

            // Determine if two objects have the same properties
            equals: function (o1, o2) {
                return angular.equals(o1, o2);
            },

            isValidCenter: function (center) {
                return angular.isDefined(center) && angular.isNumber(center.lat) &&
                    angular.isNumber(center.lng) && angular.isNumber(center.zoom);
            },

            isValidPoint: function (point) {
                return angular.isDefined(point) && angular.isNumber(point.lat) &&
                    angular.isNumber(point.lng);
            },

            isSameCenterOnMap: function (centerModel, map) {
                var mapCenter = map.getCenter();
                var zoom = map.getZoom();
                if (centerModel.lat && centerModel.lng &&
                    mapCenter.lat.toFixed(4) === centerModel.lat.toFixed(4) &&
                    mapCenter.lng.toFixed(4) === centerModel.lng.toFixed(4) &&
                    zoom === centerModel.zoom) {
                    return true;
                }
                return false;
            },

            safeApply: function ($scope, fn) {
                var phase = $scope.$root.$$phase;
                if (phase === '$apply' || phase === '$digest') {
                    $scope.$eval(fn);
                } else {
                    $scope.$apply(fn);
                }
            },

            obtainEffectiveMapId: _obtainEffectiveMapId,

            getDefer: function (d, mapId) {
                var id = _obtainEffectiveMapId(d, mapId),
                    defer;
                if (!angular.isDefined(d[id]) || d[id].resolvedDefer === false) {
                    defer = _getUnresolvedDefer(d, mapId);
                } else {
                    defer = d[id].defer;
                }
                return defer;
            },

            getUnresolvedDefer: _getUnresolvedDefer,

            setResolvedDefer: function (d, mapId) {
                var id = _obtainEffectiveMapId(d, mapId);
                d[id].resolvedDefer = true;
            },

            AwesomeMarkersPlugin: {
                isLoaded: function () {
                    if (angular.isDefined(L.AwesomeMarkers) && angular.isDefined(L.AwesomeMarkers.Icon)) {
                        return true;
                    } else {
                        return false;
                    }
                },
                is: function (icon) {
                    if (this.isLoaded()) {
                        return icon instanceof L.AwesomeMarkers.Icon;
                    } else {
                        return false;
                    }
                },
                equal: function (iconA, iconB) {
                    if (!this.isLoaded()) {
                        return false;
                    }
                    if (this.is(iconA)) {
                        return angular.equals(iconA, iconB);
                    } else {
                        return false;
                    }
                }
            },

            PolylineDecoratorPlugin: {
                isLoaded: function () {
                    if (angular.isDefined(L.PolylineDecorator)) {
                        return true;
                    } else {
                        return false;
                    }
                },
                is: function (decoration) {
                    if (this.isLoaded()) {
                        return decoration instanceof L.PolylineDecorator;
                    } else {
                        return false;
                    }
                },
                equal: function (decorationA, decorationB) {
                    if (!this.isLoaded()) {
                        return false;
                    }
                    if (this.is(decorationA)) {
                        return angular.equals(decorationA, decorationB);
                    } else {
                        return false;
                    }
                }
            },

            MakiMarkersPlugin: {
                isLoaded: function () {
                    if (angular.isDefined(L.MakiMarkers) && angular.isDefined(L.MakiMarkers.Icon)) {
                        return true;
                    } else {
                        return false;
                    }
                },
                is: function (icon) {
                    if (this.isLoaded()) {
                        return icon instanceof L.MakiMarkers.Icon;
                    } else {
                        return false;
                    }
                },
                equal: function (iconA, iconB) {
                    if (!this.isLoaded()) {
                        return false;
                    }
                    if (this.is(iconA)) {
                        return angular.equals(iconA, iconB);
                    } else {
                        return false;
                    }
                }
            },
            LabelPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.Label);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.MarkerClusterGroup;
                    } else {
                        return false;
                    }
                }
            },
            MarkerClusterPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.MarkerClusterGroup);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.MarkerClusterGroup;
                    } else {
                        return false;
                    }
                }
            },
            GoogleLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.Google);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.Google;
                    } else {
                        return false;
                    }
                }
            },
            ChinaLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.tileLayer.chinaProvider);
                }
            },
            HeatMapLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.TileLayer.WebGLHeatMap);
                }
            },
            BingLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.BingLayer);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.BingLayer;
                    } else {
                        return false;
                    }
                }
            },
            WFSLayerPlugin: {
                isLoaded: function () {
                    return L.GeoJSON.WFS !== undefined;
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.GeoJSON.WFS;
                    } else {
                        return false;
                    }
                }
            },
            AGSLayerPlugin: {
                isLoaded: function () {
                    return lvector !== undefined && lvector.AGS !== undefined;
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof lvector.AGS;
                    } else {
                        return false;
                    }
                }
            },
            YandexLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.Yandex);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.Yandex;
                    } else {
                        return false;
                    }
                }
            },
            DynamicMapLayerPlugin: {
                isLoaded: function () {
                    return L.esri !== undefined && L.esri.dynamicMapLayer !== undefined;
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.esri.dynamicMapLayer;
                    } else {
                        return false;
                    }
                }
            },
            GeoJSONPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.TileLayer.GeoJSON);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.TileLayer.GeoJSON;
                    } else {
                        return false;
                    }
                }
            },
            UTFGridPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.UtfGrid);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.UtfGrid;
                    } else {
                        $log.error('[AngularJS - Leaflet] No UtfGrid plugin found.');
                        return false;
                    }
                }
            },
            CartoDB: {
                isLoaded: function () {
                    return cartodb;
                },
                is: function (/*layer*/) {
                    return true;
                    /*
                     if (this.isLoaded()) {
                     return layer instanceof L.TileLayer.GeoJSON;
                     } else {
                     return false;
                     }*/
                }
            },
            Leaflet: {
                DivIcon: {
                    is: function (icon) {
                        return icon instanceof L.DivIcon;
                    },
                    equal: function (iconA, iconB) {
                        if (this.is(iconA)) {
                            return angular.equals(iconA, iconB);
                        } else {
                            return false;
                        }
                    }
                },
                Icon: {
                    is: function (icon) {
                        return icon instanceof L.Icon;
                    },
                    equal: function (iconA, iconB) {
                        if (this.is(iconA)) {
                            return angular.equals(iconA, iconB);
                        } else {
                            return false;
                        }
                    }
                }
            }
        };
    }]);

}());;
/*
 Leaflet.markercluster, Provides Beautiful Animated Marker Clustering functionality for Leaflet, a JS library for interactive maps.
 https://github.com/Leaflet/Leaflet.markercluster
 (c) 2012-2013, Dave Leaver, smartrak
*/
!function(t,e){L.MarkerClusterGroup=L.FeatureGroup.extend({options:{maxClusterRadius:80,iconCreateFunction:null,spiderfyOnMaxZoom:!0,showCoverageOnHover:!0,zoomToBoundsOnClick:!0,singleMarkerMode:!1,disableClusteringAtZoom:null,removeOutsideVisibleBounds:!0,animateAddingMarkers:!1,spiderfyDistanceMultiplier:1,chunkedLoading:!1,chunkInterval:200,chunkDelay:50,chunkProgress:null,polygonOptions:{}},initialize:function(t){L.Util.setOptions(this,t),this.options.iconCreateFunction||(this.options.iconCreateFunction=this._defaultIconCreateFunction),this._featureGroup=L.featureGroup(),this._featureGroup.on(L.FeatureGroup.EVENTS,this._propagateEvent,this),this._nonPointGroup=L.featureGroup(),this._nonPointGroup.on(L.FeatureGroup.EVENTS,this._propagateEvent,this),this._inZoomAnimation=0,this._needsClustering=[],this._needsRemoving=[],this._currentShownBounds=null,this._queue=[]},addLayer:function(t){if(t instanceof L.LayerGroup){var e=[];for(var i in t._layers)e.push(t._layers[i]);return this.addLayers(e)}if(!t.getLatLng)return this._nonPointGroup.addLayer(t),this;if(!this._map)return this._needsClustering.push(t),this;if(this.hasLayer(t))return this;this._unspiderfy&&this._unspiderfy(),this._addLayer(t,this._maxZoom);var n=t,s=this._map.getZoom();if(t.__parent)for(;n.__parent._zoom>=s;)n=n.__parent;return this._currentShownBounds.contains(n.getLatLng())&&(this.options.animateAddingMarkers?this._animationAddLayer(t,n):this._animationAddLayerNonAnimated(t,n)),this},removeLayer:function(t){if(t instanceof L.LayerGroup){var e=[];for(var i in t._layers)e.push(t._layers[i]);return this.removeLayers(e)}return t.getLatLng?this._map?t.__parent?(this._unspiderfy&&(this._unspiderfy(),this._unspiderfyLayer(t)),this._removeLayer(t,!0),this._featureGroup.hasLayer(t)&&(this._featureGroup.removeLayer(t),t.setOpacity&&t.setOpacity(1)),this):this:(!this._arraySplice(this._needsClustering,t)&&this.hasLayer(t)&&this._needsRemoving.push(t),this):(this._nonPointGroup.removeLayer(t),this)},addLayers:function(t){var e,i,n,s,r=this._featureGroup,o=this._nonPointGroup,a=this.options.chunkedLoading,h=this.options.chunkInterval,_=this.options.chunkProgress;if(this._map){var u=0,l=(new Date).getTime(),d=L.bind(function(){for(var e=(new Date).getTime();u<t.length;u++){if(a&&0===u%200){var i=(new Date).getTime()-e;if(i>h)break}if(s=t[u],s.getLatLng){if(!this.hasLayer(s)&&(this._addLayer(s,this._maxZoom),s.__parent&&2===s.__parent.getChildCount())){var n=s.__parent.getAllChildMarkers(),p=n[0]===s?n[1]:n[0];r.removeLayer(p)}}else o.addLayer(s)}_&&_(u,t.length,(new Date).getTime()-l),u===t.length?(this._featureGroup.eachLayer(function(t){t instanceof L.MarkerCluster&&t._iconNeedsUpdate&&t._updateIcon()}),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds)):setTimeout(d,this.options.chunkDelay)},this);d()}else{for(e=[],i=0,n=t.length;n>i;i++)s=t[i],s.getLatLng?this.hasLayer(s)||e.push(s):o.addLayer(s);this._needsClustering=this._needsClustering.concat(e)}return this},removeLayers:function(t){var e,i,n,s=this._featureGroup,r=this._nonPointGroup;if(!this._map){for(e=0,i=t.length;i>e;e++)n=t[e],this._arraySplice(this._needsClustering,n),r.removeLayer(n);return this}for(e=0,i=t.length;i>e;e++)n=t[e],n.__parent?(this._removeLayer(n,!0,!0),s.hasLayer(n)&&(s.removeLayer(n),n.setOpacity&&n.setOpacity(1))):r.removeLayer(n);return this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds),s.eachLayer(function(t){t instanceof L.MarkerCluster&&t._updateIcon()}),this},clearLayers:function(){return this._map||(this._needsClustering=[],delete this._gridClusters,delete this._gridUnclustered),this._noanimationUnspiderfy&&this._noanimationUnspiderfy(),this._featureGroup.clearLayers(),this._nonPointGroup.clearLayers(),this.eachLayer(function(t){delete t.__parent}),this._map&&this._generateInitialClusters(),this},getBounds:function(){var t=new L.LatLngBounds;this._topClusterLevel&&t.extend(this._topClusterLevel._bounds);for(var e=this._needsClustering.length-1;e>=0;e--)t.extend(this._needsClustering[e].getLatLng());return t.extend(this._nonPointGroup.getBounds()),t},eachLayer:function(t,e){var i,n=this._needsClustering.slice();for(this._topClusterLevel&&this._topClusterLevel.getAllChildMarkers(n),i=n.length-1;i>=0;i--)t.call(e,n[i]);this._nonPointGroup.eachLayer(t,e)},getLayers:function(){var t=[];return this.eachLayer(function(e){t.push(e)}),t},getLayer:function(t){var e=null;return this.eachLayer(function(i){L.stamp(i)===t&&(e=i)}),e},hasLayer:function(t){if(!t)return!1;var e,i=this._needsClustering;for(e=i.length-1;e>=0;e--)if(i[e]===t)return!0;for(i=this._needsRemoving,e=i.length-1;e>=0;e--)if(i[e]===t)return!1;return!(!t.__parent||t.__parent._group!==this)||this._nonPointGroup.hasLayer(t)},zoomToShowLayer:function(t,e){var i=function(){if((t._icon||t.__parent._icon)&&!this._inZoomAnimation)if(this._map.off("moveend",i,this),this.off("animationend",i,this),t._icon)e();else if(t.__parent._icon){var n=function(){this.off("spiderfied",n,this),e()};this.on("spiderfied",n,this),t.__parent.spiderfy()}};if(t._icon&&this._map.getBounds().contains(t.getLatLng()))e();else if(t.__parent._zoom<this._map.getZoom())this._map.on("moveend",i,this),this._map.panTo(t.getLatLng());else{var n=function(){this._map.off("movestart",n,this),n=null};this._map.on("movestart",n,this),this._map.on("moveend",i,this),this.on("animationend",i,this),t.__parent.zoomToBounds(),n&&i.call(this)}},onAdd:function(t){this._map=t;var e,i,n;if(!isFinite(this._map.getMaxZoom()))throw"Map has no maxZoom specified";for(this._featureGroup.onAdd(t),this._nonPointGroup.onAdd(t),this._gridClusters||this._generateInitialClusters(),e=0,i=this._needsRemoving.length;i>e;e++)n=this._needsRemoving[e],this._removeLayer(n,!0);this._needsRemoving=[],this._zoom=this._map.getZoom(),this._currentShownBounds=this._getExpandedVisibleBounds(),this._map.on("zoomend",this._zoomEnd,this),this._map.on("moveend",this._moveEnd,this),this._spiderfierOnAdd&&this._spiderfierOnAdd(),this._bindEvents(),i=this._needsClustering,this._needsClustering=[],this.addLayers(i)},onRemove:function(t){t.off("zoomend",this._zoomEnd,this),t.off("moveend",this._moveEnd,this),this._unbindEvents(),this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim",""),this._spiderfierOnRemove&&this._spiderfierOnRemove(),this._hideCoverage(),this._featureGroup.onRemove(t),this._nonPointGroup.onRemove(t),this._featureGroup.clearLayers(),this._map=null},getVisibleParent:function(t){for(var e=t;e&&!e._icon;)e=e.__parent;return e||null},_arraySplice:function(t,e){for(var i=t.length-1;i>=0;i--)if(t[i]===e)return t.splice(i,1),!0},_removeLayer:function(t,e,i){var n=this._gridClusters,s=this._gridUnclustered,r=this._featureGroup,o=this._map;if(e)for(var a=this._maxZoom;a>=0&&s[a].removeObject(t,o.project(t.getLatLng(),a));a--);var h,_=t.__parent,u=_._markers;for(this._arraySplice(u,t);_&&(_._childCount--,!(_._zoom<0));)e&&_._childCount<=1?(h=_._markers[0]===t?_._markers[1]:_._markers[0],n[_._zoom].removeObject(_,o.project(_._cLatLng,_._zoom)),s[_._zoom].addObject(h,o.project(h.getLatLng(),_._zoom)),this._arraySplice(_.__parent._childClusters,_),_.__parent._markers.push(h),h.__parent=_.__parent,_._icon&&(r.removeLayer(_),i||r.addLayer(h))):(_._recalculateBounds(),i&&_._icon||_._updateIcon()),_=_.__parent;delete t.__parent},_isOrIsParent:function(t,e){for(;e;){if(t===e)return!0;e=e.parentNode}return!1},_propagateEvent:function(t){if(t.layer instanceof L.MarkerCluster){if(t.originalEvent&&this._isOrIsParent(t.layer._icon,t.originalEvent.relatedTarget))return;t.type="cluster"+t.type}this.fire(t.type,t)},_defaultIconCreateFunction:function(t){var e=t.getChildCount(),i=" marker-cluster-";return i+=10>e?"small":100>e?"medium":"large",new L.DivIcon({html:"<div><span>"+e+"</span></div>",className:"marker-cluster"+i,iconSize:new L.Point(40,40)})},_bindEvents:function(){var t=this._map,e=this.options.spiderfyOnMaxZoom,i=this.options.showCoverageOnHover,n=this.options.zoomToBoundsOnClick;(e||n)&&this.on("clusterclick",this._zoomOrSpiderfy,this),i&&(this.on("clustermouseover",this._showCoverage,this),this.on("clustermouseout",this._hideCoverage,this),t.on("zoomend",this._hideCoverage,this))},_zoomOrSpiderfy:function(t){var e=this._map;e.getMaxZoom()===e.getZoom()?this.options.spiderfyOnMaxZoom&&t.layer.spiderfy():this.options.zoomToBoundsOnClick&&t.layer.zoomToBounds(),t.originalEvent&&13===t.originalEvent.keyCode&&e._container.focus()},_showCoverage:function(t){var e=this._map;this._inZoomAnimation||(this._shownPolygon&&e.removeLayer(this._shownPolygon),t.layer.getChildCount()>2&&t.layer!==this._spiderfied&&(this._shownPolygon=new L.Polygon(t.layer.getConvexHull(),this.options.polygonOptions),e.addLayer(this._shownPolygon)))},_hideCoverage:function(){this._shownPolygon&&(this._map.removeLayer(this._shownPolygon),this._shownPolygon=null)},_unbindEvents:function(){var t=this.options.spiderfyOnMaxZoom,e=this.options.showCoverageOnHover,i=this.options.zoomToBoundsOnClick,n=this._map;(t||i)&&this.off("clusterclick",this._zoomOrSpiderfy,this),e&&(this.off("clustermouseover",this._showCoverage,this),this.off("clustermouseout",this._hideCoverage,this),n.off("zoomend",this._hideCoverage,this))},_zoomEnd:function(){this._map&&(this._mergeSplitClusters(),this._zoom=this._map._zoom,this._currentShownBounds=this._getExpandedVisibleBounds())},_moveEnd:function(){if(!this._inZoomAnimation){var t=this._getExpandedVisibleBounds();this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._map._zoom,t),this._currentShownBounds=t}},_generateInitialClusters:function(){var t=this._map.getMaxZoom(),e=this.options.maxClusterRadius,i=e;"function"!=typeof e&&(i=function(){return e}),this.options.disableClusteringAtZoom&&(t=this.options.disableClusteringAtZoom-1),this._maxZoom=t,this._gridClusters={},this._gridUnclustered={};for(var n=t;n>=0;n--)this._gridClusters[n]=new L.DistanceGrid(i(n)),this._gridUnclustered[n]=new L.DistanceGrid(i(n));this._topClusterLevel=new L.MarkerCluster(this,-1)},_addLayer:function(t,e){var i,n,s=this._gridClusters,r=this._gridUnclustered;for(this.options.singleMarkerMode&&(t.options.icon=this.options.iconCreateFunction({getChildCount:function(){return 1},getAllChildMarkers:function(){return[t]}}));e>=0;e--){i=this._map.project(t.getLatLng(),e);var o=s[e].getNearObject(i);if(o)return o._addChild(t),t.__parent=o,void 0;if(o=r[e].getNearObject(i)){var a=o.__parent;a&&this._removeLayer(o,!1);var h=new L.MarkerCluster(this,e,o,t);s[e].addObject(h,this._map.project(h._cLatLng,e)),o.__parent=h,t.__parent=h;var _=h;for(n=e-1;n>a._zoom;n--)_=new L.MarkerCluster(this,n,_),s[n].addObject(_,this._map.project(o.getLatLng(),n));for(a._addChild(_),n=e;n>=0&&r[n].removeObject(o,this._map.project(o.getLatLng(),n));n--);return}r[e].addObject(t,i)}this._topClusterLevel._addChild(t),t.__parent=this._topClusterLevel},_enqueue:function(t){this._queue.push(t),this._queueTimeout||(this._queueTimeout=setTimeout(L.bind(this._processQueue,this),300))},_processQueue:function(){for(var t=0;t<this._queue.length;t++)this._queue[t].call(this);this._queue.length=0,clearTimeout(this._queueTimeout),this._queueTimeout=null},_mergeSplitClusters:function(){this._processQueue(),this._zoom<this._map._zoom&&this._currentShownBounds.intersects(this._getExpandedVisibleBounds())?(this._animationStart(),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,this._getExpandedVisibleBounds()),this._animationZoomIn(this._zoom,this._map._zoom)):this._zoom>this._map._zoom?(this._animationStart(),this._animationZoomOut(this._zoom,this._map._zoom)):this._moveEnd()},_getExpandedVisibleBounds:function(){if(!this.options.removeOutsideVisibleBounds)return this.getBounds();var t=this._map,e=t.getBounds(),i=e._southWest,n=e._northEast,s=L.Browser.mobile?0:Math.abs(i.lat-n.lat),r=L.Browser.mobile?0:Math.abs(i.lng-n.lng);return new L.LatLngBounds(new L.LatLng(i.lat-s,i.lng-r,!0),new L.LatLng(n.lat+s,n.lng+r,!0))},_animationAddLayerNonAnimated:function(t,e){if(e===t)this._featureGroup.addLayer(t);else if(2===e._childCount){e._addToMap();var i=e.getAllChildMarkers();this._featureGroup.removeLayer(i[0]),this._featureGroup.removeLayer(i[1])}else e._updateIcon()}}),L.MarkerClusterGroup.include(L.DomUtil.TRANSITION?{_animationStart:function(){this._map._mapPane.className+=" leaflet-cluster-anim",this._inZoomAnimation++},_animationEnd:function(){this._map&&(this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim","")),this._inZoomAnimation--,this.fire("animationend")},_animationZoomIn:function(t,e){var i,n=this._getExpandedVisibleBounds(),s=this._featureGroup;this._topClusterLevel._recursively(n,t,0,function(r){var o,a=r._latlng,h=r._markers;for(n.contains(a)||(a=null),r._isSingleParent()&&t+1===e?(s.removeLayer(r),r._recursivelyAddChildrenToMap(null,e,n)):(r.setOpacity(0),r._recursivelyAddChildrenToMap(a,e,n)),i=h.length-1;i>=0;i--)o=h[i],n.contains(o._latlng)||s.removeLayer(o)}),this._forceLayout(),this._topClusterLevel._recursivelyBecomeVisible(n,e),s.eachLayer(function(t){t instanceof L.MarkerCluster||!t._icon||t.setOpacity(1)}),this._topClusterLevel._recursively(n,t,e,function(t){t._recursivelyRestoreChildPositions(e)}),this._enqueue(function(){this._topClusterLevel._recursively(n,t,0,function(t){s.removeLayer(t),t.setOpacity(1)}),this._animationEnd()})},_animationZoomOut:function(t,e){this._animationZoomOutSingle(this._topClusterLevel,t-1,e),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds()),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t,this._getExpandedVisibleBounds())},_animationZoomOutSingle:function(t,e,i){var n=this._getExpandedVisibleBounds();t._recursivelyAnimateChildrenInAndAddSelfToMap(n,e+1,i);var s=this;this._forceLayout(),t._recursivelyBecomeVisible(n,i),this._enqueue(function(){if(1===t._childCount){var r=t._markers[0];r.setLatLng(r.getLatLng()),r.setOpacity&&r.setOpacity(1)}else t._recursively(n,i,0,function(t){t._recursivelyRemoveChildrenFromMap(n,e+1)});s._animationEnd()})},_animationAddLayer:function(t,e){var i=this,n=this._featureGroup;n.addLayer(t),e!==t&&(e._childCount>2?(e._updateIcon(),this._forceLayout(),this._animationStart(),t._setPos(this._map.latLngToLayerPoint(e.getLatLng())),t.setOpacity(0),this._enqueue(function(){n.removeLayer(t),t.setOpacity(1),i._animationEnd()})):(this._forceLayout(),i._animationStart(),i._animationZoomOutSingle(e,this._map.getMaxZoom(),this._map.getZoom())))},_forceLayout:function(){L.Util.falseFn(e.body.offsetWidth)}}:{_animationStart:function(){},_animationZoomIn:function(t,e){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds()),this.fire("animationend")},_animationZoomOut:function(t,e){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds()),this.fire("animationend")},_animationAddLayer:function(t,e){this._animationAddLayerNonAnimated(t,e)}}),L.markerClusterGroup=function(t){return new L.MarkerClusterGroup(t)},L.MarkerCluster=L.Marker.extend({initialize:function(t,e,i,n){L.Marker.prototype.initialize.call(this,i?i._cLatLng||i.getLatLng():new L.LatLng(0,0),{icon:this}),this._group=t,this._zoom=e,this._markers=[],this._childClusters=[],this._childCount=0,this._iconNeedsUpdate=!0,this._bounds=new L.LatLngBounds,i&&this._addChild(i),n&&this._addChild(n)},getAllChildMarkers:function(t){t=t||[];for(var e=this._childClusters.length-1;e>=0;e--)this._childClusters[e].getAllChildMarkers(t);for(var i=this._markers.length-1;i>=0;i--)t.push(this._markers[i]);return t},getChildCount:function(){return this._childCount},zoomToBounds:function(){for(var t,e=this._childClusters.slice(),i=this._group._map,n=i.getBoundsZoom(this._bounds),s=this._zoom+1,r=i.getZoom();e.length>0&&n>s;){s++;var o=[];for(t=0;t<e.length;t++)o=o.concat(e[t]._childClusters);e=o}n>s?this._group._map.setView(this._latlng,s):r>=n?this._group._map.setView(this._latlng,r+1):this._group._map.fitBounds(this._bounds)},getBounds:function(){var t=new L.LatLngBounds;return t.extend(this._bounds),t},_updateIcon:function(){this._iconNeedsUpdate=!0,this._icon&&this.setIcon(this)},createIcon:function(){return this._iconNeedsUpdate&&(this._iconObj=this._group.options.iconCreateFunction(this),this._iconNeedsUpdate=!1),this._iconObj.createIcon()},createShadow:function(){return this._iconObj.createShadow()},_addChild:function(t,e){this._iconNeedsUpdate=!0,this._expandBounds(t),t instanceof L.MarkerCluster?(e||(this._childClusters.push(t),t.__parent=this),this._childCount+=t._childCount):(e||this._markers.push(t),this._childCount++),this.__parent&&this.__parent._addChild(t,!0)},_expandBounds:function(t){var e,i=t._wLatLng||t._latlng;t instanceof L.MarkerCluster?(this._bounds.extend(t._bounds),e=t._childCount):(this._bounds.extend(i),e=1),this._cLatLng||(this._cLatLng=t._cLatLng||i);var n=this._childCount+e;this._wLatLng?(this._wLatLng.lat=(i.lat*e+this._wLatLng.lat*this._childCount)/n,this._wLatLng.lng=(i.lng*e+this._wLatLng.lng*this._childCount)/n):this._latlng=this._wLatLng=new L.LatLng(i.lat,i.lng)},_addToMap:function(t){t&&(this._backupLatlng=this._latlng,this.setLatLng(t)),this._group._featureGroup.addLayer(this)},_recursivelyAnimateChildrenIn:function(t,e,i){this._recursively(t,0,i-1,function(t){var i,n,s=t._markers;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(e),n.setOpacity(0))},function(t){var i,n,s=t._childClusters;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(e),n.setOpacity(0))})},_recursivelyAnimateChildrenInAndAddSelfToMap:function(t,e,i){this._recursively(t,i,0,function(n){n._recursivelyAnimateChildrenIn(t,n._group._map.latLngToLayerPoint(n.getLatLng()).round(),e),n._isSingleParent()&&e-1===i?(n.setOpacity(1),n._recursivelyRemoveChildrenFromMap(t,e)):n.setOpacity(0),n._addToMap()})},_recursivelyBecomeVisible:function(t,e){this._recursively(t,0,e,null,function(t){t.setOpacity(1)})},_recursivelyAddChildrenToMap:function(t,e,i){this._recursively(i,-1,e,function(n){if(e!==n._zoom)for(var s=n._markers.length-1;s>=0;s--){var r=n._markers[s];i.contains(r._latlng)&&(t&&(r._backupLatlng=r.getLatLng(),r.setLatLng(t),r.setOpacity&&r.setOpacity(0)),n._group._featureGroup.addLayer(r))}},function(e){e._addToMap(t)})},_recursivelyRestoreChildPositions:function(t){for(var e=this._markers.length-1;e>=0;e--){var i=this._markers[e];i._backupLatlng&&(i.setLatLng(i._backupLatlng),delete i._backupLatlng)}if(t-1===this._zoom)for(var n=this._childClusters.length-1;n>=0;n--)this._childClusters[n]._restorePosition();else for(var s=this._childClusters.length-1;s>=0;s--)this._childClusters[s]._recursivelyRestoreChildPositions(t)},_restorePosition:function(){this._backupLatlng&&(this.setLatLng(this._backupLatlng),delete this._backupLatlng)},_recursivelyRemoveChildrenFromMap:function(t,e,i){var n,s;this._recursively(t,-1,e-1,function(t){for(s=t._markers.length-1;s>=0;s--)n=t._markers[s],i&&i.contains(n._latlng)||(t._group._featureGroup.removeLayer(n),n.setOpacity&&n.setOpacity(1))},function(t){for(s=t._childClusters.length-1;s>=0;s--)n=t._childClusters[s],i&&i.contains(n._latlng)||(t._group._featureGroup.removeLayer(n),n.setOpacity&&n.setOpacity(1))})},_recursively:function(t,e,i,n,s){var r,o,a=this._childClusters,h=this._zoom;if(e>h)for(r=a.length-1;r>=0;r--)o=a[r],t.intersects(o._bounds)&&o._recursively(t,e,i,n,s);else if(n&&n(this),s&&this._zoom===i&&s(this),i>h)for(r=a.length-1;r>=0;r--)o=a[r],t.intersects(o._bounds)&&o._recursively(t,e,i,n,s)},_recalculateBounds:function(){var t,e=this._markers,i=this._childClusters;for(this._bounds=new L.LatLngBounds,delete this._wLatLng,t=e.length-1;t>=0;t--)this._expandBounds(e[t]);for(t=i.length-1;t>=0;t--)this._expandBounds(i[t])},_isSingleParent:function(){return this._childClusters.length>0&&this._childClusters[0]._childCount===this._childCount}}),L.DistanceGrid=function(t){this._cellSize=t,this._sqCellSize=t*t,this._grid={},this._objectPoint={}},L.DistanceGrid.prototype={addObject:function(t,e){var i=this._getCoord(e.x),n=this._getCoord(e.y),s=this._grid,r=s[n]=s[n]||{},o=r[i]=r[i]||[],a=L.Util.stamp(t);this._objectPoint[a]=e,o.push(t)},updateObject:function(t,e){this.removeObject(t),this.addObject(t,e)},removeObject:function(t,e){var i,n,s=this._getCoord(e.x),r=this._getCoord(e.y),o=this._grid,a=o[r]=o[r]||{},h=a[s]=a[s]||[];for(delete this._objectPoint[L.Util.stamp(t)],i=0,n=h.length;n>i;i++)if(h[i]===t)return h.splice(i,1),1===n&&delete a[s],!0},eachObject:function(t,e){var i,n,s,r,o,a,h,_=this._grid;for(i in _){o=_[i];for(n in o)for(a=o[n],s=0,r=a.length;r>s;s++)h=t.call(e,a[s]),h&&(s--,r--)}},getNearObject:function(t){var e,i,n,s,r,o,a,h,_=this._getCoord(t.x),u=this._getCoord(t.y),l=this._objectPoint,d=this._sqCellSize,p=null;for(e=u-1;u+1>=e;e++)if(s=this._grid[e])for(i=_-1;_+1>=i;i++)if(r=s[i])for(n=0,o=r.length;o>n;n++)a=r[n],h=this._sqDist(l[L.Util.stamp(a)],t),d>h&&(d=h,p=a);return p},_getCoord:function(t){return Math.floor(t/this._cellSize)},_sqDist:function(t,e){var i=e.x-t.x,n=e.y-t.y;return i*i+n*n}},function(){L.QuickHull={getDistant:function(t,e){var i=e[1].lat-e[0].lat,n=e[0].lng-e[1].lng;return n*(t.lat-e[0].lat)+i*(t.lng-e[0].lng)},findMostDistantPointFromBaseLine:function(t,e){var i,n,s,r=0,o=null,a=[];for(i=e.length-1;i>=0;i--)n=e[i],s=this.getDistant(n,t),s>0&&(a.push(n),s>r&&(r=s,o=n));return{maxPoint:o,newPoints:a}},buildConvexHull:function(t,e){var i=[],n=this.findMostDistantPointFromBaseLine(t,e);return n.maxPoint?(i=i.concat(this.buildConvexHull([t[0],n.maxPoint],n.newPoints)),i=i.concat(this.buildConvexHull([n.maxPoint,t[1]],n.newPoints))):[t[0]]},getConvexHull:function(t){var e,i=!1,n=!1,s=null,r=null;for(e=t.length-1;e>=0;e--){var o=t[e];(i===!1||o.lat>i)&&(s=o,i=o.lat),(n===!1||o.lat<n)&&(r=o,n=o.lat)}var a=[].concat(this.buildConvexHull([r,s],t),this.buildConvexHull([s,r],t));return a}}}(),L.MarkerCluster.include({getConvexHull:function(){var t,e,i=this.getAllChildMarkers(),n=[];for(e=i.length-1;e>=0;e--)t=i[e].getLatLng(),n.push(t);return L.QuickHull.getConvexHull(n)}}),L.MarkerCluster.include({_2PI:2*Math.PI,_circleFootSeparation:25,_circleStartAngle:Math.PI/6,_spiralFootSeparation:28,_spiralLengthStart:11,_spiralLengthFactor:5,_circleSpiralSwitchover:9,spiderfy:function(){if(this._group._spiderfied!==this&&!this._group._inZoomAnimation){var t,e=this.getAllChildMarkers(),i=this._group,n=i._map,s=n.latLngToLayerPoint(this._latlng);this._group._unspiderfy(),this._group._spiderfied=this,e.length>=this._circleSpiralSwitchover?t=this._generatePointsSpiral(e.length,s):(s.y+=10,t=this._generatePointsCircle(e.length,s)),this._animationSpiderfy(e,t)}},unspiderfy:function(t){this._group._inZoomAnimation||(this._animationUnspiderfy(t),this._group._spiderfied=null)},_generatePointsCircle:function(t,e){var i,n,s=this._group.options.spiderfyDistanceMultiplier*this._circleFootSeparation*(2+t),r=s/this._2PI,o=this._2PI/t,a=[];for(a.length=t,i=t-1;i>=0;i--)n=this._circleStartAngle+i*o,a[i]=new L.Point(e.x+r*Math.cos(n),e.y+r*Math.sin(n))._round();return a},_generatePointsSpiral:function(t,e){var i,n=this._group.options.spiderfyDistanceMultiplier*this._spiralLengthStart,s=this._group.options.spiderfyDistanceMultiplier*this._spiralFootSeparation,r=this._group.options.spiderfyDistanceMultiplier*this._spiralLengthFactor,o=0,a=[];for(a.length=t,i=t-1;i>=0;i--)o+=s/n+5e-4*i,a[i]=new L.Point(e.x+n*Math.cos(o),e.y+n*Math.sin(o))._round(),n+=this._2PI*r/o;return a},_noanimationUnspiderfy:function(){var t,e,i=this._group,n=i._map,s=i._featureGroup,r=this.getAllChildMarkers();for(this.setOpacity(1),e=r.length-1;e>=0;e--)t=r[e],s.removeLayer(t),t._preSpiderfyLatlng&&(t.setLatLng(t._preSpiderfyLatlng),delete t._preSpiderfyLatlng),t.setZIndexOffset&&t.setZIndexOffset(0),t._spiderLeg&&(n.removeLayer(t._spiderLeg),delete t._spiderLeg);i._spiderfied=null}}),L.MarkerCluster.include(L.DomUtil.TRANSITION?{SVG_ANIMATION:function(){return e.createElementNS("http://www.w3.org/2000/svg","animate").toString().indexOf("SVGAnimate")>-1}(),_animationSpiderfy:function(t,i){var n,s,r,o,a=this,h=this._group,_=h._map,u=h._featureGroup,l=_.latLngToLayerPoint(this._latlng);for(n=t.length-1;n>=0;n--)s=t[n],s.setOpacity?(s.setZIndexOffset(1e6),s.setOpacity(0),u.addLayer(s),s._setPos(l)):u.addLayer(s);h._forceLayout(),h._animationStart();var d=L.Path.SVG?0:.3,p=L.Path.SVG_NS;for(n=t.length-1;n>=0;n--)if(o=_.layerPointToLatLng(i[n]),s=t[n],s._preSpiderfyLatlng=s._latlng,s.setLatLng(o),s.setOpacity&&s.setOpacity(1),r=new L.Polyline([a._latlng,o],{weight:1.5,color:"#222",opacity:d}),_.addLayer(r),s._spiderLeg=r,L.Path.SVG&&this.SVG_ANIMATION){var c=r._path.getTotalLength();r._path.setAttribute("stroke-dasharray",c+","+c);var f=e.createElementNS(p,"animate");f.setAttribute("attributeName","stroke-dashoffset"),f.setAttribute("begin","indefinite"),f.setAttribute("from",c),f.setAttribute("to",0),f.setAttribute("dur",.25),r._path.appendChild(f),f.beginElement(),f=e.createElementNS(p,"animate"),f.setAttribute("attributeName","stroke-opacity"),f.setAttribute("attributeName","stroke-opacity"),f.setAttribute("begin","indefinite"),f.setAttribute("from",0),f.setAttribute("to",.5),f.setAttribute("dur",.25),r._path.appendChild(f),f.beginElement()}if(a.setOpacity(.3),L.Path.SVG)for(this._group._forceLayout(),n=t.length-1;n>=0;n--)s=t[n]._spiderLeg,s.options.opacity=.5,s._path.setAttribute("stroke-opacity",.5);setTimeout(function(){h._animationEnd(),h.fire("spiderfied")},200)},_animationUnspiderfy:function(t){var e,i,n,s=this._group,r=s._map,o=s._featureGroup,a=t?r._latLngToNewLayerPoint(this._latlng,t.zoom,t.center):r.latLngToLayerPoint(this._latlng),h=this.getAllChildMarkers(),_=L.Path.SVG&&this.SVG_ANIMATION;for(s._animationStart(),this.setOpacity(1),i=h.length-1;i>=0;i--)e=h[i],e._preSpiderfyLatlng&&(e.setLatLng(e._preSpiderfyLatlng),delete e._preSpiderfyLatlng,e.setOpacity?(e._setPos(a),e.setOpacity(0)):o.removeLayer(e),_&&(n=e._spiderLeg._path.childNodes[0],n.setAttribute("to",n.getAttribute("from")),n.setAttribute("from",0),n.beginElement(),n=e._spiderLeg._path.childNodes[1],n.setAttribute("from",.5),n.setAttribute("to",0),n.setAttribute("stroke-opacity",0),n.beginElement(),e._spiderLeg._path.setAttribute("stroke-opacity",0)));setTimeout(function(){var t=0;for(i=h.length-1;i>=0;i--)e=h[i],e._spiderLeg&&t++;for(i=h.length-1;i>=0;i--)e=h[i],e._spiderLeg&&(e.setOpacity&&(e.setOpacity(1),e.setZIndexOffset(0)),t>1&&o.removeLayer(e),r.removeLayer(e._spiderLeg),delete e._spiderLeg);s._animationEnd()},200)}}:{_animationSpiderfy:function(t,e){var i,n,s,r,o=this._group,a=o._map,h=o._featureGroup;for(i=t.length-1;i>=0;i--)r=a.layerPointToLatLng(e[i]),n=t[i],n._preSpiderfyLatlng=n._latlng,n.setLatLng(r),n.setZIndexOffset&&n.setZIndexOffset(1e6),h.addLayer(n),s=new L.Polyline([this._latlng,r],{weight:1.5,color:"#222"}),a.addLayer(s),n._spiderLeg=s;this.setOpacity(.3),o.fire("spiderfied")},_animationUnspiderfy:function(){this._noanimationUnspiderfy()}}),L.MarkerClusterGroup.include({_spiderfied:null,_spiderfierOnAdd:function(){this._map.on("click",this._unspiderfyWrapper,this),this._map.options.zoomAnimation&&this._map.on("zoomstart",this._unspiderfyZoomStart,this),this._map.on("zoomend",this._noanimationUnspiderfy,this),L.Path.SVG&&!L.Browser.touch&&this._map._initPathRoot()},_spiderfierOnRemove:function(){this._map.off("click",this._unspiderfyWrapper,this),this._map.off("zoomstart",this._unspiderfyZoomStart,this),this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._unspiderfy()},_unspiderfyZoomStart:function(){this._map&&this._map.on("zoomanim",this._unspiderfyZoomAnim,this)},_unspiderfyZoomAnim:function(t){L.DomUtil.hasClass(this._map._mapPane,"leaflet-touching")||(this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._unspiderfy(t))},_unspiderfyWrapper:function(){this._unspiderfy()},_unspiderfy:function(t){this._spiderfied&&this._spiderfied.unspiderfy(t)},_noanimationUnspiderfy:function(){this._spiderfied&&this._spiderfied._noanimationUnspiderfy()},_unspiderfyLayer:function(t){t._spiderLeg&&(this._featureGroup.removeLayer(t),t.setOpacity(1),t.setZIndexOffset(0),this._map.removeLayer(t._spiderLeg),delete t._spiderLeg)}})}(window,document);;
/*
 * Google layer using Google Maps API
 */
//(function (google, L) {

L.Google = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		opacity: 1,
		continuousWorld: false,
		noWrap: false,
		mapOptions: {
			backgroundColor: '#dddddd'
		}
	},

	// Possible types: SATELLITE, ROADMAP, HYBRID, TERRAIN
	initialize: function(type, options) {
		L.Util.setOptions(this, options);

		this._ready = google.maps.Map != undefined;
		if (!this._ready) L.Google.asyncWait.push(this);

		this._type = type || 'SATELLITE';
	},

	onAdd: function(map, insertAtTheBottom) {
		this._map = map;
		this._insertAtTheBottom = insertAtTheBottom;

		// create a container div for tiles
		this._initContainer();
		this._initMapObject();

		// set up events
		map.on('viewreset', this._resetCallback, this);

		this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
		map.on('move', this._update, this);

		map.on('zoomanim', this._handleZoomAnim, this);

		//20px instead of 1em to avoid a slight overlap with google's attribution
		map._controlCorners['bottomright'].style.marginBottom = "20px";

		this._reset();
		this._update();
	},

	onRemove: function(map) {
		this._map._container.removeChild(this._container);
		//this._container = null;

		this._map.off('viewreset', this._resetCallback, this);

		this._map.off('move', this._update, this);

		this._map.off('zoomanim', this._handleZoomAnim, this);

		map._controlCorners['bottomright'].style.marginBottom = "0em";
		//this._map.off('moveend', this._update, this);
	},

	getAttribution: function() {
		return this.options.attribution;
	},

	setOpacity: function(opacity) {
		this.options.opacity = opacity;
		if (opacity < 1) {
			L.DomUtil.setOpacity(this._container, opacity);
		}
	},

	setElementSize: function(e, size) {
		e.style.width = size.x + "px";
		e.style.height = size.y + "px";
	},

	_initContainer: function() {
		var tilePane = this._map._container,
			first = tilePane.firstChild;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-google-layer leaflet-top leaflet-left');
			this._container.id = "_GMapContainer_" + L.Util.stamp(this);
			this._container.style.zIndex = "auto";
		}

		if (true) {
			tilePane.insertBefore(this._container, first);

			this.setOpacity(this.options.opacity);
			this.setElementSize(this._container, this._map.getSize());
		}
	},

	_initMapObject: function() {
		if (!this._ready) return;
		this._google_center = new google.maps.LatLng(0, 0);
		var map = new google.maps.Map(this._container, {
		    center: this._google_center,
		    zoom: 0,
		    tilt: 0,
		    mapTypeId: google.maps.MapTypeId[this._type],
		    disableDefaultUI: true,
		    keyboardShortcuts: false,
		    draggable: false,
		    disableDoubleClickZoom: true,
		    scrollwheel: false,
		    streetViewControl: false,
		    styles: this.options.mapOptions.styles,
		    backgroundColor: this.options.mapOptions.backgroundColor
		});

		var _this = this;
		this._reposition = google.maps.event.addListenerOnce(map, "center_changed",
			function() { _this.onReposition(); });
		this._google = map;

		google.maps.event.addListenerOnce(map, "idle",
			function() { _this._checkZoomLevels(); });
	},

	_checkZoomLevels: function() {
		//setting the zoom level on the Google map may result in a different zoom level than the one requested
		//(it won't go beyond the level for which they have data).
		// verify and make sure the zoom levels on both Leaflet and Google maps are consistent
		if (this._google.getZoom() !== this._map.getZoom()) {
			//zoom levels are out of sync. Set the leaflet zoom level to match the google one
			this._map.setZoom( this._google.getZoom() );
		}
	},

	_resetCallback: function(e) {
		this._reset(e.hard);
	},

	_reset: function(clearOldContainer) {
		this._initContainer();
	},

	_update: function(e) {
		if (!this._google) return;
		this._resize();

		var center = e && e.latlng ? e.latlng : this._map.getCenter();
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(this._map.getZoom());

		this._checkZoomLevels();
		//this._google.fitBounds(google_bounds);
	},

	_resize: function() {
		var size = this._map.getSize();
		if (this._container.style.width == size.x &&
		    this._container.style.height == size.y)
			return;
		this.setElementSize(this._container, size);
		this.onReposition();
	},


	_handleZoomAnim: function (e) {
		var center = e.center;
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(e.zoom);
	},


	onReposition: function() {
		if (!this._google) return;
		google.maps.event.trigger(this._google, "resize");
	}
});

L.Google.asyncWait = [];
L.Google.asyncInitialize = function() {
	var i;
	for (i = 0; i < L.Google.asyncWait.length; i++) {
		var o = L.Google.asyncWait[i];
		o._ready = true;
		if (o._container) {
			o._initMapObject();
			o._update();
		}
	}
	L.Google.asyncWait = [];
};
//})(window.google, L);
var gfsad = {};
gfsad.decToHex = function (n) {
    // return two digit hex number
    if (n > 255) {
        throw "Cannot convert to hex.";
    }
    return (n + 0x100).toString(16).substr(-2).toUpperCase();
};;
var app = angular.module("app", ["leaflet-directive", "ngRoute", 'mgcrea.ngStrap', 'server']);
app.config(['$tooltipProvider', '$routeProvider', '$sceDelegateProvider', '$locationProvider', 'server.config', function ($tooltipProvider, $routeProvider, $sceDelegateProvider, $locationProvider, serverConfig) {
    var cdn = serverConfig.cdn;

    $routeProvider
        .when('/app/map', {
            templateUrl: '/static/templates/map.html',
            controller: 'MapController',
            reloadOnSearch: false
        }).when('/app/a/login', {
            templateUrl: '/static/templates/account/login.html',
            controller: 'LoginController'
        }).when('/app/a/register', {
            templateUrl: '/static/templates/account/register.html',
            controller: 'RegisterController'
        }).when('/app/a/forgot', {
            templateUrl: '/static/templates/account/forgot.html',
            controller: 'ForgotController'
        }).when('/app/a/reset', {
            templateUrl: '/static/templates/account/reset.html',
            controller: 'ResetController'
        }).when('/app/a/logout', {
            templateUrl: '/static/templates/account/logout.html',
            controller: 'LogoutController'
        }).when('/app/classify', {
            templateUrl: '/static/templates/classify.html',
            controller: 'ClassifyController'
        }).otherwise({
            templateUrl: '/static/templates/404.html'
        });
    $locationProvider.html5Mode(true);
//    $locationProvider.hashPrefix('!/');

    angular.extend($tooltipProvider.defaults, {
        animation: 'am-fade-and-scale',
        trigger: 'hover',
        placement: 'bottom',
        container: 'body'
    });
    $sceDelegateProvider.resourceUrlWhitelist([
        // Allow same origin resource loads.ot
        'self',
        // Allow loading from our assets domain.  Notice the difference between * and **.
        'http://cache.croplands.org/static/**',
        'https://hwstatic.croplands.org/**']);
}]);
;
app.factory('RatingService', ['$http', '$rootScope', 'log', 'User', '$q','locationFactory', function ($http, $rootScope, log, User, $q, locationFactory) {
    var ratingLookup = {},
//        _baseUrl = 'http://127.0.0.1:8000';
        _baseUrl = 'https://api.croplands.org';

    /**
     * Applies a rating to a record.
     * @param record
     * @param rating
     * @returns {*}
     */
    function rateRecord(record, rating) {
        var deferred = $q.defer();
        $http({
            method: 'POST',
            url: _baseUrl + '/api/ratings',
            data: {
                record_id: record.id,
                rating: rating
            }
        }).then(function (response) {
            record.user_rating = response.data;
            record.visited = true;
            locationFactory.setIcon(record);
            log.debug('[RatingService] Set the rating to: '+ String(rating));
            deferred.resolve(record);
        }, function (err) {
            log.error('[RatingService] Could not set rating.');
            deferred.reject(err);
        });

        return deferred.promise;
    }

    function getRecordRatings() {
        log.info('[RatingService] Getting Ratings for Records');
        var deferred = $q.defer(), id;
        if (User.isLoggedIn() && User.get().id) {

            id = User.get().id;

            $http({
                method: 'GET',
                url: _baseUrl + '/api/ratings?q={"filters":[{"name":"user_id","op":"eq","val":' + id + '}]}'
            }).then(function (response) {
                log.info(response);
                _.each(response.data.objects, function (r) {
                    ratingLookup[r.record_id] = r;
                });

                _.each(locationFactory.getRecords(), function (l){
                    if (ratingLookup[l.id]) {
                        l.user_rating = ratingLookup[l.id];
                        locationFactory.setIcon(l);
                    }
                });

                deferred.resolve();
            }, function (err) {
                log.error(err);
                deferred.reject(err);
            });

        } else {
            deferred.reject();
        }


        return deferred.promise;
    }

    $rootScope.$on('locationFactory.markers.downloaded', function (){
        getRecordRatings();
    });

    return {
        rateRecord: rateRecord,
        getRecordRatings: getRecordRatings
    };
}]);;
app.factory('User', [ '$http', '$window', '$q', 'log','$rootScope', function ($http, $window, $q, log, $rootScope) {
    var _user = {},
      _baseUrl = 'https://api.croplands.org';

    function getUser() {
        return _user;
    }

    function getRole() {
        var role;
        if (_user.role) {
            role = _user.role;
        } else {
            role = 'anon';
        }

        log.debug('[UserService] getRole() : ' + role);

        return role;
    }

    function loadFromToken(token) {
        _user = JSON.parse($window.atob(token.split(".")[1]));
        _user.token = token;
        $window.localStorage.user = JSON.stringify(_user);
        // save token for future requests
        $http.defaults.headers.post.authorization = 'bearer ' + _user.token;
        $http.defaults.headers.put.authorization = 'bearer ' + _user.token;
        $http.defaults.headers.patch.authorization = 'bearer ' + _user.token;
    }

    function isLoggedIn() {
        if (_user.expires && _user.token) {
            var secondsToExpiration = _user.expires - Math.floor((new Date).getTime() / 1000);
            return secondsToExpiration > 300;
        }

        return false;
    }

    function changePassword(token, password) {
        var deferred = $q.defer();
        $http.post("https://api.croplands.org/auth/reset", {
            token: token,
            password: password
        }).then(function (response) {
            deferred.resolve(true);
        }, function (error) {
            deferred.resolve(false);
        });
        return deferred.promise;
    }

    function login(email, password) {
        log.info("[User] Logging in...");

        var deferred = $q.defer(),
            data = {email: email, password: password},
            headers = {'Content-Type': 'application/json'};


        $http.post(_baseUrl + "/auth/login", data, headers).then(function (r) {
                log.info("[User] Successfully logged in.");
                // Load user if token is present, may require confirmation before logging in
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
                $rootScope.$emit('User.change');
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function register(data) {
        var deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post(_baseUrl + "/auth/register", data, headers).then(function (r) {
                log.info("[User] Successfully registered.");
                // Load user if token is present, may require confirmation before logging in
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
                $rootScope.$emit('User.change');
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject(r);
                }
            }
        );

        return deferred.promise;
    }

    function forgot(email) {
        var data = {email: email},
            deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post("https://api.croplands.org/auth/forgot", data, headers).then(function (r) {
                log.info("[User] Sending reset email.");
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function reset(password, token) {
        var data = {password: password, token: token},
            deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post("https://api.croplands.org/auth/reset", data, headers).then(function (r) {
                log.info("[User] Changing password.");
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function logout() {
        log.info("[User] Removing user token.");

        if ($window.localStorage.user) {
            $window.localStorage.removeItem('user');
        }

        _user = {};
        delete $http.defaults.headers.post.authorization;
        delete $http.defaults.headers.put.authorization;
        delete $http.defaults.headers.patch.authorization;
        $rootScope.$emit('User.change');
    }

    function getFromStorage() {
        var user = JSON.parse($window.localStorage.user);
        loadFromToken(user.token);
        $rootScope.$emit('User.change');
    }

    // initialization
    function init() {
        // Check if user information is available in local storage
        log.info('Checking for existence of user token.');
        if ($window.localStorage.user) {
            getFromStorage();

        }

        // Watch for changes in other tabs
        angular.element($window).on('storage', function (event) {
            if ($window.localStorage.user) {
                getFromStorage();
            } else {
                _user = {};
            }
        });
    }

    init();


    return {
        changePassword: changePassword,
        getRole: getRole,
        isLoggedIn: isLoggedIn,
        login: login,
        logout: logout,
        register: register,
        forgot: forgot,
        reset: reset,
        get: getUser
    };

}]);;
app.constant('countries', [
      "Afghanistan", "Aland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola",
      "Anguilla", "Antarctica", "Antigua And Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria",
      "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
      "Bermuda", "Bhutan", "Bolivia, Plurinational State of", "Bonaire, Sint Eustatius and Saba", "Bosnia and Herzegovina",
      "Botswana", "Bouvet Island", "Brazil",
      "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia",
      "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China",
      "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo",
      "Congo, the Democratic Republic of the", "Cook Islands", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba",
      "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
      "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Falkland Islands (Malvinas)",
      "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia",
      "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece",
      "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea",
      "Guinea-Bissau", "Guyana", "Haiti", "Heard Island and McDonald Islands", "Holy See (Vatican City State)",
      "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran, Islamic Republic of", "Iraq",
      "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya",
      "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kuwait", "Kyrgyzstan",
      "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
      "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Macedonia, The Former Yugoslav Republic Of",
      "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique",
      "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Moldova, Republic of",
      "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
      "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger",
      "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau",
      "Palestinian Territory, Occupied", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines",
      "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation",
      "Rwanda", "Saint Barthelemy", "Saint Helena, Ascension and Tristan da Cunha", "Saint Kitts and Nevis", "Saint Lucia",
      "Saint Martin (French Part)", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
      "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
      "Sint Maarten (Dutch Part)", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
      "South Georgia and the South Sandwich Islands", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
      "Svalbard and Jan Mayen", "Swaziland", "Sweden", "Switzerland", "Syrian Arab Republic",
      "Taiwan, Province of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Timor-Leste",
      "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
      "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
      "United States", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu",
      "Venezuela, Bolivarian Republic of", "Viet Nam", "Virgin Islands, British", "Virgin Islands, U.S.",
      "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"
    ])
;
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
;
app.factory("icons", [ function (){
var base = {
shadowUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAYAAACoYAD2AAAC5ElEQVRYw+2YW4/TMBCF45S0S1luXZCABy5CgLQgwf//S4BYBLTdJLax0fFqmB07nnQfEGqkIydpVH85M+NLjPe++dcPc4Q8Qh4hj5D/AaQJx6H/4TMwB0PeBNwU7EGQAmAtsNfAzoZkgIa0ZgLMa4Aj6CxIAsjhjOCoL5z7Glg1JAOkaicgvQBXuncwJAWjksLtBTWZe04CnYRktUGdilALppZBOgHGZcBzL6OClABvMSVIzyBjazOgrvACf1ydC5mguqAVg6RhdkSWQFj2uxfaq/BrIZOLEWgZdALIDvcMcZLD8ZbLC9de4yR1sYMi4G20S4Q/PWeJYxTOZn5zJXANZHIxAd4JWhPIloTJZhzMQduM89WQ3MUVAE/RnhAXpTycqys3NZALOBbB7kFrgLesQl2h45Fcj8L1tTSohUwuxhy8H/Qg6K7gIs+3kkaigQCOcyEXCHN07wyQazhrmIulvKMQAwMcmLNqyCVyMAI+BuxSMeTk3OPikLY2J1uE+VHQk6ANrhds+tNARqBeaGc72cK550FP4WhXmFmcMGhTwAR1ifOe3EvPqIegFmF+C8gVy0OfAaWQPMR7gF1OQKqGoBjq90HPMP01BUjPOqGFksC4emE48tWQAH0YmvOgF3DST6xieJgHAWxPAHMuNhrImIdvoNOKNWIOcE+UXE0pYAnkX6uhWsgVXDxHdTfCmrEEmMB2zMFimLVOtiiajxiGWrbU52EeCdyOwPEQD8LqyPH9Ti2kgYMf4OhSKB7qYILbBv3CuVTJ11Y80oaseiMWOONc/Y7kJYe0xL2f0BaiFTxknHO5HaMGMublKwxFGzYdWsBF174H/QDknhTHmHHN39iWFnkZx8lPyM8WHfYELmlLKtgWNmFNzQcC1b47gJ4hL19i7o65dhH0Negbca8vONZoP7doIeOC9zXm8RjuL0Gf4d4OYaU5ljo3GYiqzrWQHfJxA6ALhDpVKv9qYeZA8eM3EhfPSCmpuD0AAAAASUVORK5CYII=",
 iconSize: [25, 41],
 iconAnchor: [12, 41],
 shadowAnchor: [12, 41],
 popupAnchor: [1, -34],
 shadowSize: [41, 41]
};

return {
iconCroplandContinuousIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigated: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFn0lEQVR4nL2XX2xb1R3HP+d3r+3YTlKnJaHtAs1GQ9V2bTP+tDDRCg3WTQxpEkIa0gRF5qXSJMTQpEnbHq72Ak8TT/QFxjDtBAIEKlNFg1qFTlX/aEiASquohbistGnSJNd27PvH996zBydeXNupQd3O0z33/H7fz/n4XF/L6sCBA/yvhwnw5N+sT7WozE1P1/rS/j3WAyaAiti2aiB50xmzk5V1T/3VGlLGQ8MPRqb6YP26Fd3FMLhpgF7D5MKlYiBe9FMTyChTutEaO6zeNEhCCfGYYQZe9KCpFffF44KnNQCP9G/g8ZHHKPtl/nLiFSb8yneCBGi6TKEYU0OiTbXaFKkvbr/9bv7xxSEqfoWNK26r388YMfYO/6RjSKg1sbigQj1iqlCPdMUFT0cAJOMp3KrL70+80tC0Y+UQ24d2YDsF3rz0yQ0hVa1JGQZa0S1aVEaJaip6bO02tiT76vO+RC8Auzfu7sgkIFq87BYV6kyXIfgLJo5foSvWxY5193Jb90DLgIwR42f9wzwxePeyIOkSJORWUZoVKi6E1A7+9Nef8OjmRwA4V/g3AEPxJCenzuL4FRy/wh93PM2vRh6nEnjLQpSqfULm0gnAoelxDn30QkPxz9fdz5a1W/hqZoKx/El+c/8zABybHm8L8KKIuFnLFYC4UnhR1Lbhw4snANi8ZjPrM4McGT/K4XOHeeIHO5c1WRwmgB9EJETagtJGgrc+e49N/etRKEYGt7IqfQuj50bbBidE8INankQGX1b9EBNp27Bz8C6evvfX9KVWcnLqLKvStwBwcursMrsXqn5IZHBZgFNlJyAljZCheJKMEQPgza/+ieNXGB4Y5kerhnnr03d49fQbbF15R1tISoSyEwCMiYS8XSpX/aSSBpe877CrfwMZI8bWnjWMjh9l9NwoM47N6u4Bntn+JPcMjrQECJBUQqlc9SXkbcllrfcJIu15EUkxG4oPTp5hV/8G1nYP8Mstj7Lzjgf4vHSFH67ZBMDxi6fq1rsyt3NPT+17lRQT1wshiHQua70vAFoYnSl6dIvRtKuDk2fIJHuZLc+QjKd4ePVmLtuXOTJ+lJ54mt9u+gUbVgxyzP6af5WmAOgxTGaLPlr4+6IZEvKsO+8HMa2Iq+YH4MOLJyg4BV49/QYlv8yV4iQ//v59pONpXhsf5fD0+XptQgSJwJ33Awn5cx2Sy1r5SNSXswWPHsNsguR9h/PTF9j+vW3ctXYbuzfu5uDZQ7w+cbzpNygjMeyCRyScymWtfB1Ss9F7iwUvSmohIS1srnzOnbfeyfDAMB9fONaw+6UWMa0o2m4gIX+qZy9e5LLWWKQ4P1vwyEisKcAOq1ya+wan6vD6xPGm9UWL2YKHVnyRy1pjTZC6je2GMa1a2hSdAvmZfEvAUgsV8VxD7tJJLmuNacWZdjbVqErJK7W1mLJdIkMdWWrRBAFQEc8VbTdoZ2NX7KZ7KTGQACoFL5BA771+vSkll7XGIkMduWa7TTZ9qZVMO3NNkD4jxvR/LfLXrzc/r4AEeu+87U309SRIiUElCgF44bN3mmrTYhJVNW7JR6DJoqXJgk0+MtXhadulz2g+m6UjY5gLFnzQyqItZNHGLflEVU1aWgo3WoQ82zar3UIua+W18O607ZJp8Ra4zuK1dhbLQgBUxO+ced9vZZMWk2o1wpn3fQl5frmcZSE1G7XvypzTYCMLFpPXHLSofbmsZX9nCICE2qqWq77vhPQu2PQaMXwnJHQDX0Jt3TDjRgW5rGVrUfuuLpyNgaJXDK7abkcWHUGgZhO6gec4IatjCZyahdeJRceQhd2+dHXOCQyluDrnBMBLnVh0DAFQmhdDLwyvzbqEXlhWmhc77e0YUjsbni/OuWjhD51afCsIwP491stacWr/Huvlb9On/h//4/8DG/mJNHLsnIYAAAAASUVORK5CYII=" }, base),
iconCroplandContinuousUnknown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigated: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFm0lEQVR4nL2XX2xbVx3HP+d3r+04TlKnXdI/RGtg9aK1tA1jtNu0lmmDggYS0lSJSWh08l4qIU1jmoQEPFzxwp7QnlZpYpS5LWLagKmT0BqpVSiqmlY8rKO0ROlWF5U0f5rk2o59//jee3hwYpLaTr2pcJ7uPb/f+X7Ox+fK11YnTpzgfz1MgOd/a32kRaXvebrWN48fsp4wAVTE7g39yXvOmJ+qbP3hb6xBZTydeTIy1Qfbtq7rKobBPQP0GCbXbhYD8aJvmkBamdKF1thh9Z5BEkqIxwwz8KInTa14NB4XPK0BeKZviIPDz1L2y7x58Rh/dxY+FyRA02EKxZgaFG2qTaZIvdgR6+DNsaNMTI+T6b2/Pp82YhzOPNU2JNSaWFxQoR4WFerhjrjg6QiAP05e4p+VOTIbh5gsTdcX7V0/yJ7BvTw38NW2IFWt6TAMtKJLtKi0ErWq4eDg40xMjzNWmqrP9SZ6ADjw0IG2IAHR8mWXqFCnOwzBXzJ5pm+ITH+G3MSZlgFpI8a3+jJ3tZIOQUI2itKsU3EhpHbwX9+2j76uPn711Ks8u2U3AIPxJGMzV3D8Co5f4Wd7X+D7wwepBN6aEKVqn5C58gbgJ+d/3dD87a2PsXPLTj6du85ofowfPfYiAGdnx1sCvCgibtZyBSCuFF4UtVzw4Y3zAOzYvINt6QFOj5/h1NVTPPelfWuaLA8TwA8iEiItQSkjwTuX/sT2vm0oFMMDu9iQuo+RqyMtgxMi+EEtTyKDT6p+iIm0XLBv4GFe+NoP6O1cz9jMFTak7gNgbObKGrsXqn5IZDApwIWyE9ApqyGD8SRpIwbA7z/9K45fIdOf4SsbMrzz0Xu8dfEYu9Y/0BLSKULZCQBGRULeLZWrflLJKpe877C/b4i0EWNX92ZGxs8wcnWEOcdmU1c/L+55nkcGhpsCBEgqoVSu+hLyruSy1vsEkfa8iKSYq5pPTl1mf98QW7r6+d7O77LvgSf4uHSLL2/eDsC5Gxfq1vvT9/NIdz8ASTFxvRCCSOey1vsCoIWRuaJHlxgNuzo5dZl0sof58hzJeCff2LSDSXuS0+Nn6I6n+PH27zC0boCz9r/4W2kGgG7DZL7oo4XfLZshIS+5i34Q04q4anwAPrxxnoJT4K2Lxyj5ZW4Vp3j8i4+Siqc4Oj7CqdmJem9CBInAXfQDCflFHZLLWvlI1CfzBY9uw2yA5H2Hidlr7PnCbh7espsDDx3g5JU/8/b1cw3voLTEsAsekXAhl7XydUjNRh8uFrwoqYWENLG59TEPbnyQTH+Gv1w7u2r3Ky1iWlG03UBCfl7PXr7IZa3RSDExX/BIS6whwA6r3Fz4N07V4e3r5xrqyxbzBQ+t+Ecua402QOo2thvGtGpqU3QK5OfyTQErLVTEy6tyV97kstaoVlxuZVONqpS8UkuLGdslMtTplRYNEAAV8XLRdoNWNnbFbpjrFAMJoFLwAgn04TvrDSm5rDUaGer0bdttsOntXM9skx8WvUaM2f9a5O+sNz6vgAT68KLtXe/tTtApBpUoBOCXl95r6E2JSVTVuCUfgQaLpiZLNvnIVKdmbZdeo/FsVo60YS5Z8EEzi5aQZRu35BNVNSlpKrzaIuSlllmtCrmsldfCH2Ztl3STb4E7LI62slgTAqAiXnUWfb+ZTUpMqtUIZ9H3JeSVtXLWhNRs1JFbC84qG1mymLrtoEUdyWUt+3NDACTUVrVc9X0npGfJpseI4TshoRv4Emrrrhl3a8hlLVuLOjK9dDYGih4xmLbdtizagkDNJnQDz3FCNsUSODULrx2LtiFLu319esEJDKWYXnAC4PV2LNqGACjNa6EXhrfnXUIvLCvNa+2ubRtSOxteKS64aOGn7Vp8JgjA8UPWG1px4fgh643Psk79P/7H/weyXIWydKOIVgAAAABJRU5ErkJggg==" }, base),
iconCroplandDoubleUnknown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAG30lEQVR4nLWXa2wU1xXHf/fO7KzXXnvXNtjGmGKKHQsotuMkPFICSRto01ZqSqMWtSJES9VYrRSRNlLVR6pNFKn0Q1uplRKpUhKygaoJJCAitcEU1xAhHglNoGCz5WWosQ1+MF4/Zmd2Zm4/GFve+oGj0vNpZvac87v/c+ecuSt27drF/9t0gM074p8oKaJ3PbtSHTu3xNfoAMKnrrgkdNcZ/d0jC598LV4ptC9WP+zr4r2qhZFwynPvGqBA07nYkXKl7a/XgajQZRilML3MXYMEhcQIaLpr+w9LJVhlGBJbKQA2ltfxh3XPsCq/7FMn3lhex/cWrwPARZGjS/yAqJRKF2W6lOOO73aeJs/Im5QgqgVorP7CrIGeUgQMifBUvRSeqs8xJLbyZwxaWVTJisqVbKq4b1aQjFLkaBpKEJZKiqiQ4o5BhcECADYs2TAriMv4osNSeCqao0mcOyiZaFEtwJfmVt9RlcyRSI9SKRQRYUg81LTOlUaI4zdbsZwRLGeEn698im/XP8GIa88IEWK0QvrEmzGLHfxV1v2XF65meflyLvddoaX9OD9cvRWAIz3JLL93O0+PX9u+j6GP5pUAhhDY/vTlev/qMQCWzVtGVbSCQ8lmDrQdYNNnH5pRyZjpAI7rE5RyWlCeFuSt03tZOrcKgaC+opbivDk0tTVNmzgoJY47mk/6GpcyjoeOnDbgoYoGnnrguxTmFnH8ZivFeXMAOH6zdYbVSzKOh6/RKYETw5ZLrsyGVBoholoAgD9f/gDLGaG6pJp7i6t565M9vHryTWqLFk8LyZWSYcsFaJHSY/fgcMYJCZmlpd2xWDu3hqgWoDZ/Hk3JZpramuizTMrCJWxdsZn7K+qnBEggJCSDwxlHeuyWiVh8H66vbNsnJPUs5/3dZ1k7t4bycAlfX/41Hlq8hjODXXxu3lIAjl49Ma56bfQz3J9fAkBI6qRtD1xfJWLxfRJASZr6UjZhqU1a1f7us0RDBfQP9xEycnm0bBmdZieHks3kG3k8u/Sr1EQqOGJe46PBmwDkazr9KQcl+dOYMqTHM+khxw0ogSEmvwDvXz3GgDXAqyffZNAZpivVzYOLVpFn5PF6sokDPRfGfYNSIn1IDzmu9HhxHJKIxdt9KS71D9jka/okSLtjcaHnIivm19FQXseGJRvY3/oX3rhydNI3KCoDmAM2vuREIhZvH4eMqlGNqQHbDylJUE6hpusM95TeQ3VJNYcvHsla/UQVASVImWlXevxiPPfYRSIWb/EFF/oHbKIyMCmB6WXouHUdK2PxxpWjk34fU9E/YKME5xKxeMvY86zaSE81psz034oiQW2qCZCyBnA8J+tZcSqTDGR8KyAEYUOErpvpxUKxbaJPFiQRi7ds3hE/2z9g10WjBjf87Cmb8TNk7NHDRsPFwZa6y4MNhs+iAk03AFKe66xCpWq+8a3eaSEAwmdbykwfLIoE9anUmCMmXznVd7KyJ712RX5UlmpZpTVueJmiD/fu/jiVbHuhauvTLwGTB1YiFm/xNXGo10xP2pvC3CL8o6cOV/Vm7tsQmTMOCFYWULS+lgVPP86i+gWsjxTrI+fbnr/23r7HpoQASFc1Dpk20oXcCQ3624/eHgi3dqxuCOdr9/7ueR5pS7Lo2e/w4F8/pO73u6na9msa/riHgkUR6vPCRufh5rc9y5qi87jdN7o40GOmKZxQjrK+9Pmw1LVSLUCgIApAIFKUFRuIzqWgfimlWoBcIQ3zQrJs2vkuXdWYHnTwM4q82zOtKJWxKoycybPnvyyndPTMVh4IGsPXO2qmhSRi8XYleafHTBOdYgrMZEUPrMle8EzOwuc5a8hxxtQM5Wp6jzvaJ+dfepFTscfoeGcPGbMnK+5mywEAelyHnOLijhkho2rEK123LKKazrXS3OV9dpoh38duT5E6dpmRf3bT+ssfAGBdPcffl9TQtfMgQ75Pn52meHn9pRkhANJT8cxwxnEsj2DQiPxrceTwB4OmN3Z2Bug/eAbr6jn0yOj3xFaKo0MDzsJHHt2ohULqjpBELG4qKV65cXtvji2JruvLEf9uTvV7QxMatfWF5/jH959gyPdpGTQdv7CwZcHj39wLU3T8dGq8tNtoWV6wLBSk6fMVldUf32ge6u1dUaAFjPJA0KD5LJ0Z2xlRvjN/zbonxwAAYrb/GTe/Ht+uBbUfV87P19uvD7qe7f1mx6af/NS8kCwbvt5RA5A3vyIZra7p1kKhrOPorN9Nodju2d623v607tnesFBs10IhVVxb31VcW981YyVmCxndG36UupVGSX6WiMXN2cbOGgKwc0v8ZSU4sXNL/OVPEzfrPflf7D+Ct+IV815cxwAAAABJRU5ErkJggg==" }, base),
iconCroplandSingleIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFZUlEQVR4nL2XX2xUVR7HP+d378x0Om2ZgtTSbZYqVCIIrX8WcCNodhVNdpNNzCZrYlzM6AOJCVHjk/pw44s+mmwiT646glmj6xpMNtINpIshgvFBDAtpQBkMW0pL2zszbe+fufceH9qOHe5MO2xYz9M99/zO9/P73HNzJ6MOHTrE/3uYAE+9a32jRWVverrWlw/utR4wAVTEwJqu9E1nTI3Nrf/zX60+Zfy2/6HIVJ9tXL+qrRQGNw3QYZhcuFwKxIseMYGsMqUNrbHDyk2DpJSQTBhm4EUPiVbsTCYFT2sAHu8Z4C8P7mdne/cNBz/eM8CzGx4EIEDTYgpRQvWJNlW3KVIt/GT0NJlkJhaQNRLs6/9N08BQaxJJQYV6UFSoB1uSgqejZTftWN3H9r4dPNF7b1OQita0GAZa0SZaVFaJWnFTZ6oDgD137mkKElBtuk1UqLMthuCvYLJ0ZI0Ej67tX9FKWgQJuVWUZpVKCiG6YXFfMs3J8bM4/hyOP8crO57mT4N/ZC7wloUoNf+EzKWTxZH71+s188fW38/Wnq18P3mR4cJJnrv/GQCOT4zU1H0yerp67UURSXM+VwCSSuFFjR/X55e+BGDLui1szPZydOQYR84d4Ynbdy1rsjhMAD+ISIk0BGWMFB+e/geb125EoRjs3caazC0MnRtqGJwSwQ/m8yQy+K7ih5hIww27eu/h6V89SWfrak6On2VN5hYATo6fXaZ7oeKHRAajApyadQJapRbSl0yTNRIA/O37L3D8Ofq7+rl7TT8ffvMxb3/1PttWb2gIaRVh1gkAhkVCPirPVvy0khqXgu+we+0mskaCbe3rGBo5xtC5ISYdm+62Lp7Z/hT39Q7WBQiQVkJ5tuJLyEeSz1mfEkTa8yLSYtYUHx47w+61m+hp6+IPW3/Prg0P8G35Cnet2wzAiUunqta7s7/kvvYuANJi4nohBJHO56xPBUALQ5MljzYxYl0dHjtDNt3B1Owk6WQrD3dvYdQe5ejIMdqTGV7Y/Ds2rerluP0DX5fHAWg3TKZKPlr4YNEMCdnvzvhBQiuSKv4CfH7pS4pOkbe/ep+yP8uV0hi/vm0nmWSGd0aGODJxvlqbEkEicGf8QEJeq0LyOasQifpuqujRbpgxSMF3OD9xge2/GOCengH23LmHw2f/yXsXT8R+g7KSwC56RMKpfM4qVCHzNnpfqehFaS2kpI7NlW+549Y76O/q598Xjtd0v9QioRUl2w0k5NVq9uJFPmcNR4rzU0WPrCRiAXZY4fL0f3EqDu9dPBFbX7SYKnpoxX/yOWs4Bqna2G6Y0KquTckpUpgs1AUstVARz9fkLp3kc9awVpxpZFOJKpS9ckOLcdslMtTRpRYxCICKeL5ku0EjG3vOjt1rFQMJYK7oBRLofdevx1LyOWs4MtTRa7Ybs+lsXc2EMx2DdBoJJn6yKFy/Hn9fAQn0vhnbu9jZnqJVDOaiEIDXT38cq82ISVTRuGUfgZhFXZMFm0JkqiMTtkunET+bpSNrmAsWfFbPoiFk0cYt+0QVTUbqCtdahOxvmNVoIZ+zClr4+4Ttkq3zFbjO4p1GFstCAFTES86M79ezyYhJpRLhzPi+hLy4XM6ykHkbdeDKtFNjIwsWY9cctKgD+Zxl/88QAAm1VZmt+L4T0rFg02Ek8J2Q0A18CbW1YsZKBfmcZWtRB64unI2BokMMrtpuUxZNQWDeJnQDz3FCuhMpnHkLrxmLpiEL3b55ddoJDKW4Ou0EwJvNWDQNAVCaN0IvDK9NuYReOKs0bzS7t2nI/NnwYmnaRQsvN2txQxCAg3utt7Ti1MG91ls3sk/9HP/jfwSWSGv1cyGh2QAAAABJRU5ErkJggg==" }, base),
iconCroplandSingleIrrigated: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABXdJREFUeNq8V2tsVEUU/u5rt9vu0qWyfVjU8mipaA2gprQ0sUiAoDFGgsgPUfSHabXgI8T4VvAH/DFRqCEQDf1TEiT4CCFSIwkkBfEHKYqN5bFQaEt3tw+63d273d279zpnSjds7t52a6qT3J07d+ac73xnzpw5KxiGgf+6CQSiNK24YEiCe8a160avtvdMHQexNdYacxfOPEbv1RHq5skMoF63ieGS2Q5nQIvPGEChbMON3LAmqVqZzMZuwSY5iVF/YmzGQPIECY4cWY6rWr1oiMJyh0OGqut88tPKdeh55TA2eiqmrZhkD1S/yt9j0OGyy0jmiGWibhOKbZKYWrij62fMzi0wKShRctBS81rWgBrzjN0hQUwYS0T6cebKiBjJSYU2lC7FhmXPY/fDz2YFEmOecSkyDBFOkUJXFIUphUqdhbxveqIpK5A4xt0Pg4EImuF2KRKiejJrV5DrtpbVTMlKymPu0owiUdCNfIH5ToP1yV/qyMdh7ykE1RH+nNzQjF1P70QwFpkUZMJDcmpwFxHn16vTFr+55AWsrlyN8z3n8W3Hd2jdtJ9/b+luT1tHQTPRwkkNDtt4QPFfhyDyj1btqwuHef/kolWoLnkI+9sPYM/pPdj12EtZuZczURNJOCXZEqjAlosPT3yO+rLlzCoR6xavxf0FD6D5dLOlYtJHejkTXRG8Y6oGG0RLgc2Ln0Hz+i9Q6i7le0MA1OjdqpE+0qvLwi1JrL6vWpKlqoJZdowkE2mbLQgCwrqG3/2dePnBp7CwsBwDQzdx/O8TOHLxJzzqWYT24WsZQYoVO4aHYlCjiWOSvGyurmr6+nlFTmmIgdyJbvi0GLYuqIc3dAtr51Sgy3cJf/R24NpID6qKKvHxmvdQkJOPb7razHvAjJvLwvzqzdG4GNd3iPF9Z39ELGmojNosUUlbvOvKr9hSVofKe+bjgzXvYvPjL6Jt8DJWVazk860XjqRYbyl5BM/NWcDHpCcSYV5hekk/3whDwi89ARUFkmKyioCKXYXovd2D/Fw3GstXMVZdPMI8LMd9v3I76ooWo6X/T/ww6OUycxQbegeipPdQKoTZqdwWGo5qOSzROEQpYwj7R/1oOPo2BtRhXB64gk3LNmK2w4032puxt/u3tKgSWVCFhlSN6d2Zun65H7fVdRV78ha5iu3oiUdNQJRCKjzlcOW4UDO/Fu8f/yRN+URbaMvDoC8KXyB8hq7eFBP+ktAbAv6Inm/I3BoTm0ttWLFgBQc4eK4lIwDJkTcCvjCx+CilO5U19509pYu40uuPoFiymxTQrdnZ34ngWBBbz7dmDlsmR/KGgE7SZwJJsfGFk2RNJjYBti8dNzssT/gECyFpvJWmN+0OYOjMir+s2IyxszOkDlqy8PaH6ISfvJuFCYRHArOCrLFi0x/0mb65WehL7FgE/RGNHb4GU8o33Wi0N8yaG76wiQ3lruvBPhPIvex0d/eHoSsisejOWEGakltjbRnrrldVFcIvxtNymilDSzZ4dAUXLwZ4IZcJJGPqpYWs4Gsj68jKyRolQs5CFo5lArAE4RPMt6FBFcmYzq21YkHztI6yhqUuy2qDWcUqmaNkJVk7BYuDViwmBbkTadtHh6LxTGxoPBZLguYZi3cmLSgmrZ2IjSzsu9Q3msaG7gsaX+0eBc2zdSP/GuROFvgsdjsWj4YSrFIfB/KwnsaJcDxO81PqmLISZFaStd5bbG/Y3wGFVTYedvhonA2LrEAm2DCrYyFmfbk9D6FxFrFsWGQNwq0V8KW3L6QpbD+op3E2LLIG4ZGmG7sTkUTyRl8YCTURoXHWxTOllWwfqan2daWhxqB+OnLTAqFHbqw5N10Z4f/4H/+PAAMAZdcbF+U/NqsAAAAASUVORK5CYII=" }, base),
iconCroplandSingleRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFm0lEQVR4nL2XX2xb5RmHn+89x8exnaROSkPbhTaFmop2bTPGWja1hcHWXWzSpGnSkCZWZG4iTWJQ7Wp/pKPdjItJ44ruhjFMi8ZgGyoI0UitMqAiRdtEUWmp+icu6tL8aZJjO/HxOT7nfLtImiU9dmqmbt+Vj7/3/T3v4++zJasjR47wv14mwON/sD/SorK3PV3rq4cP2HtMABWxc3VP6rYzpseqG3/0e7tPGY/mHo5M9ebmjavay2Fw2wCdhsnFq+VAvOibJpBVprSjNU5Yv22QpBKshGEGXvSwqRUPWpbgaQ3A99bv5Ou5hzjyzz8xXBlrKXCTleaXD/0EgM+mr2D/4xUCNG2mUE6oPtGmWmuKLDb8ZfQ0GSsTC8oaCQZyj6wI++37v2ND90Y2WWlCrUlYggp1v6hQ97dZgqejFQN2d/exq283j/V+uSW7uta0GQZa0S5aVFaJumVTV7ITgP337W9a88yeAT4d+5QRv0rA4tDtokKdbTME/xYmS1fWSPCtNbmY1VufvM1d3XctPkubICF3itKsUpYQopuG9lkphifO4vpVXL/Kz3c/wQ/6v0818JbVjVbGyVgZtqe6AFBq/hNSxqM53Xv3KmZCHy9qbDOQe4Tt67dzeWqEoeIwP/7qkwAcPPGbFa/9BivF5UsOAmAp1RQA8M6VDwDYtm4bm7O9HD9/gmPnjvHY3Xub9ixdJoAfRCRFmoIyRpJXT/+VrWs2o1D09+5gdeYOBs8NNg1OiuAH83kSGVyq+yEm0rRhb+/9PPGVH9KV7mZ44iyrM3cAMDxxdoXphbofEhmMCnBqzg1Iy3JIn5UiayQA+OPl93D9KrmeHF9anePVj17nhQ9fZkf3PU0haRHm3ABgSCTktcpc3U8pWeZS9F32rdlC1kiwo2Mdg+dPMHhukCnXYW17D0/uepwHevsbAgRIKaEyV/cl5DUp5O03CCLteREpMZcVHx07w741W1jf3sN3t3+Hvffs4ePKNb64bisAJ6+cWrTel93AAx09AKTEpOaFEES6kLffEAAtDE6VPdrFiE11dOwM2VQn03NTpKw031i7jVFnlOPnT9BhZXhm67fZsqqXd53P+HtlAoAOw2S67KOFV26YISFP1Wb9IKEVlopfgHeufEDJLfHChy9T8ee4Vh7ja5seJGNlePH8IMcmLyzWJkWQCGqzfiAhv1qEFPJ2MRJ1abrk0WGYMUjRd7kweZFdX9jJ/et3sv++/Rw9+zYvjZyMfRmzksApeUTCqULeLi5C5m30QLnkRSktJKWBzbWPuffOe8n15PjbxXeXTb/UIqEVZacWSMgvFrNvvCjk7aFIcWG65JGVRCzACetcnfkXbt3lpZGTsf0bFtMlD634pJC3h2KQRRunFia0amhTdksUp4oNAUstVMTTy3KXPhTy9pBWnGlmU4/qVLxKU4sJp0ZkqONLLWIQABXxdNmpBc1snKoTey8tBhJAteQFEuiBm/djKYW8PRQZ6vh1pxaz6Up3M+nOxCBdRoLJ/1gUb96P31dAAj0w63gjXR1J0mJQjUIAfn369VhtRkyiuqZW8RGIWTQ0WbApRqY6NunU6DLiZ7N0ZQ1zwYI3G1k0hdywqVV8oromIw2Fl1uEPNU0q9lGIW8XtfDnSadGtsGvwE0WLzazWBECoCJ+6s76fiObjJjU6xHurO9LyMGVclaEzNuoQ9dm3GU2smAxdt1FizpUyNvOfw0BkFDb9bm677shnQs2nUYC3w0Ja4EvobZvmXGrgkLedrSoQ+MLZ2Og6BSDcafWkkVLEJi3CWuB57ohaxNJ3HkLrxWLliEL0z43PuMGhlKMz7gB8FwrFi1DAJTm2dALw+vTNUIvnFOaZ1vtbRkyfzYcLM/U0MLPWrX4XBCAwwfs57Xi1OED9vOfp0/9P/7H/xs9pYiR1cD9BgAAAABJRU5ErkJggg==" }, base),
iconCroplandSingleRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFVklEQVR4nL2XX2xUVR7HP+d378x0Om2ZgtTCNktXqURYoLoKuBHWrMpu4iYmZpM12ShmfCHZhKjxSX248UUfTTaRJ1cdwWj8G0yMdAOpGCKYfRDDQhpQhg1CaWl7Z6bt/TP33OND/9hyZ9rRZff3dM+c8/t+zueem3sz6uDBg/yvywZ47A3nayMqf8PTjbl0YI9zrw2gYrau6srecMb48PS6x//h9Crr/r77Ylt9sn7diraKjm4YoMOyOX+pEkkQP2gDeWVLG8bg6toNg2SUkE5ZdhTE94lR7EinhcAYAB5Zu5W//24fO9q7/ytIhKHFFuKU6hVjq25bZH7yw8unyKVziaa8lWJv3++bhmhjSKUFpU2/KG36W9JCYOIlm7av7GVb73Ye7flNU5CaMbRYFkbRJkZUXolatqkz0wHA7tt3NwWJmN90myht8i2WEC5jsrDyVoo/rO5b1kpaBNHcLMqwQqUFjWm4uDed5cTIGbxwGi+c5vntT/CX/j8zHQVLQpSauUP2wsFcFf750qLxH9fdw+a1m/lu7AKDpRP87Z4nATg2OtQQEMQxaXsmVwDSShHEjW/XZxe/BGDTmk2sz/dwZOgoh88e5tFbdi5pMlc2QBjFZEQagnJWhndPfcTG1etRKPp7trAqdxMDZwcaBmdECKOZPIktvq2FGhtp2LCz506euPuvdLau5MTIGVblbgLgxMiZJXYv1EJNbHFZgJNTXkSrLIb0prPkrRQA73z3BV44TV9XH3es6uPdr9/nta/eYsvKWxtCWkWY8iKAQRHNe9WpWphVssilFHrsWr2BvJViS/saBoaOMnB2gDHPpbutiye3PcZdPf11AQJklVCdqoWieU+KBedjotgEQUxW7EWLDw2fZtfqDaxt6+LhzX9i56338k31Cr9esxGA4xdPzlvvyv+Su9q7AMiKjR9oiGJTLDgfC4ARBsYqAW1iJXZ1aPg0+WwH41NjZNOtPNC9icvuZY4MHaU9nePpjQ+xYUUPx9z/8K/qCADtls14JcQIb8+ZIZp9/mQYpYwirZIPwGcXv6TslXntq7eohlNcqQzz21/tIJfO8frQAIdHz82vzYggMfiTYSSaF+chxYJTikV9O14OaLfsBKQUepwbPc+2X2zlzrVb2X37bg6d+ZQ3LxxPfIPyksItB8TCyWLBKc1DZmzM3ko5iLNGyEgdmyvfcNvNt9HX1cfn548t2v1Ci5RRVFw/Es0L89lzF8WCMxgrzo2XA/KSSgS4usalie/xah5vXjiemJ+zGC8HGMW/iwVnMAGZt3F9nTKqrk3FK1MaK9UFLLRQMU8tyl04KBacQaM43cimFteoBtWGFiOuT2ypIwstEhAAFfNUxfWjRjbutJv4rVUsJILpchBJZPZeP59IKRacwdhSR665fsKms3Ulo95EAtJppRj90aJ0/XzyeQUkMnsn3eBCZ3uGVrGYjjUAL516P7E2JzZxzeBXQwQSFnVNZm1Ksa0Oj7o+nVbybBZW3rJnLfiknkVDyJyNXw2Ja4ac1BVebKHZ1zCr0USx4JSM8MGo65Ov8xa4zuL1RhZLQgBUzLPeZBjWs8mJTa0W402GoWieWSpnSciMjdp/ZcJbZCOzFsPXPIyo/cWC4/5sCIBo49SmamHoaTpmbTqsFKGn0X4UijbOshnLLSgWHNeI2n919mwsFB1icdX1m7JoCgIzNtqPAs/TdKcyeDMWQTMWTUNmd/vK1QkvspTi6oQXAa80Y9E0BEAZXtaB1tfGfXSgp5Th5WZ7m4bMnA3PVCZ8jPBcsxY/CQJwYI/zqlGcPLDHefWn9Kn/x//4HwDPrGgv82aw1AAAAABJRU5ErkJggg==" }, base),
iconCroplandSingleUnknown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABWtJREFUeNq8V2tsFFUU/ua122136VLZPixqebRUtAZQAy1NLBIgaIyRIPJDFP+YVgs+QoxvBX/AHxOFGoLR0D+YIMFHCJEaSSApiD9IUWwsj4VCW7q7fdDt7s52d2dnvOeWbtjMTjto9Sazd+/ce853vnPPPfeMYBgG/usmEIjSvPycIQneadeuG73anlP1HMTRVGfMnj/9GL2XR6ibIzOABt0hRstmutwhLTltAMWyA9fyo5qkahUyG3sFh+QmRv2psWkDKRAkuPJkOalqDaIhCstcLhmqrvPJj6rXouelg9jgq/pXIAno8DhlpPPEClF3CKUOScxMbu/6CTPzi0xCZUoeWmtftg2iMc84XRLElLFIpB93voyYkZ5UaH35Yqxf8ix2Pfi0PSbMMx5FhiHCLVLoiqIwpVC5u5j3zY812wJJYtz9MBiIoBlejyIhrqdtu4Jct6WidkpWUgFzl2aUiIJuFArMdxqsT/5iVyEO+k8grI7w5/j6Fux8cgfCidikIBMekjOD24i4v1iVtfi1Rc9hVfUqnO05i687vsWBjfv4+9budkuAaFqDyzEeUPzXJYj8pVX7/NxB3j++YCWWlj2Afe1fYvfJ3dj5yAu23MuZqKk03JJsCVTkyMd7xz5BQ8UyZpWItQvX4N6i+9ByssVSMekjvZyJrgj+MVWDA6KlwKaFT6Fl3aco95bzvSEAavTfqpE+0qvLwg1JXHrPUkmWaopmODGSTmVttiAIiOoafgt24sX7n8D84koMDF3H0b+O4dD5H/GwbwHah6/kBClVnBgeSkCNp45I8pLZuqrp6+aUuKUhBnIruhHQEtgyrwH+yA2smVWFrsAF/N7bgSsjPagpqcYHq99GUV4hvupqM+8BM242C/PL10eTYlLfLib3nv4BibShMmozRCVr8c5Lv2BzRT2q75qLd1e/hU2PPo+2wYtYWbWCzx84dyjDenPZQ3hm1jw+Jj2xGPMK00v6+UYYEn7uCakokhSTVQRU6ilG780eFOZ70VS5krHq4hHmYznuuxXbUF+yEK39f+D7QT+XmaU40DsQJ73fZEKYncqtkeG4lscSjUuUcoZwcDSIxsNvYEAdxsWBS9i4ZANmurx4tb0Fe7p/zYoqkQVVZEjVmN4dmeuX+3FrfVepr2CBp9SJnmTcBEQppMpXCU+eB7Vz6/DO0Q+zlE+0+Y4CDAbiCISip+jqzTDhf1J6YygY0wsNmVtjYnOhDcvnLecA+8+05gQgOfJGKBAlFu9ndGey5t7TJ3QRl3qDMZRKTpMCujU7+zsRHgtjy9kDucOWyZG8IaCT9JlAMmwC0TRZk4tNiO1Lx/UOyxM+wUJIG69n6c26Axg6s+JPKzZj7OwMqYOWLPz9ETrhx29nYQLhkcCsIGus2PSHA6Z3Xhb6EjsW4WBMY4ev0ZTyTTca7Q2z5logamJDuetquM8Ecjc73d39UeiKSCy6c1aQpuTWVFfBuqs1NcUIismsnGbK0JIDPl3B+fMhXsjlAsmZemkhK/jayDqycrJGiZCzkIUjuQAsQfgE821kUEU6oXNrrVjQPK2jrGGpy7LaYFaxSuYwWUnWTsFivxWLSUFuRdq20aF4MhcbGo8l0qB5xuLNSQuKSWsnYiMLey/0jWaxofuCxpe7R0HzbN3IPwa5lQU+TtxMJOORFKvUx4F8rKdxKppM0vyUOqasBJmVZK3/Btsb9jmgsMrGxw4fje2wsAUywYZZnYgw6yudBYiMs0jYYWEbhFsr4DN/X0RT2H5QT2M7LGyD8EjTjV2pWCp9rS+KlJqK0dh28Uxpxe4jNde9ojTWGtTfidwdgdAjN9WeuVMZ4f/4jv9bgAEA7E8W5DXKeKMAAAAASUVORK5CYII=" }, base),
iconCroplandTripleIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFnklEQVR4nL2XW2gc1x2Hv/Of2V3tri4ryZJtVU2UxBthu7bVNLXTYrshFxfSQmkpNFBSh82LoGASUwq9PAx9aR76ECjEUEjcbOzSkJQGB0IssFFTTORQaBJcGyFf1qlr667ZXUlz2Zk5fdClkndXXhe352nmnP/5feebc2Zg1MmTJ/lfNxPgud9bn2hRmXuervWNE4et/SaAitjT2Z2854zZ8cX7f/S61aeMJ7OPR6Z6b9v9bc2lMLhngFbD5PKNUiBe9LQJZJQpzWiNHVbuGSShhHjMMAMvely04rF4XPC0BuCZrn5ef/pn/PYbR3ggnrqr4J/u+i7PdPUDEKBpMoUopvpEm2qLKbKu+HcjxxmbGGV72xdX+zJGjMHsEw0DQ62JxQUV6gFRoR5oiguejgB4f2qUnpbNdKQ7uVT85+qkfR197O3bx7O9X2kIUtGaJsNAK5pFi8ooUVVFnc2b1pm0J1oBOLT9UEOQgGjlsllUqDNNhuAvm3yvZw9jc58zMz9NU6ypZkDGiPHNruwdraRJkJDNojRtKi6ELG28W3F5af8gyXiKv0+PAdAXTzIyeRHHX8TxF/nFvuf5wcD3WQy8DSFKLT0hZTyZ1b0PtjEX+nhRVLN4MPsEu3p2cXXmGsOFEX78tRcAOHr2Nxse+/viSa5esRGAuFJ1AQAfXP8IgJ1bd7It08uZ0bOcvnSaZx88sKHJSjMB/CAiIVIXlDYSvPXpn9nRtQ2FYqB3N53pTQxdGqobnBDBD5byJDK4UvFDTKTuhAO9j/D8V39Ie6qDkcmLdKY3ATAyeXGD1QsVPyQyuCnA+QUnIHXbC9kXT5IxYgD88epfcfxFst1ZvtyZ5a1P3uG1j99kd8dDdSEpERacAGBYJOTt8kLFTypZ51LwHQ529ZMxYuxu2crQ6FmGLg0x49hsae7mhb3P8WjvQE2AAEkllBcqvoS8Lfmc9S5BpD0vIinmuuJT4xc42NVPT3M339n1bQ48tJ/Pyrf40tYdAJy7fn7V+mDmPh5t6QYgKSauF0IQ6XzOelcAtDA0U/JoFqNqVafGL5BJtjK7MEMynuKpLTu5ad/kzOhZWuJpXtrxLfrbevnQ/py/lScBaDFMZks+WvjDihkScsSd94OYVsRV9QH44PpHFJ0ir338JmV/gVulcb7+wGOk42mOjw5xempstTYhgkTgzvuBhPxqFZLPWYVI1JXZokeLYVZBCr7D2NRl9n5hD4/07OHQ9kOcuvg+b1w7V/UyZiSGXfSIhPP5nFVYhSzZ6MFS0YuSWkhIDZtbn/Hw5ofJdmf5y+UP161+rUVMK0q2G0jIL1ezVy7yOWs4UozNFj0yEqsKsMMKN+b+hVNxeOPauarxFYvZoodW/COfs4arIKs2thvGtKppU3KKFGYKNQFrLVTEi+ty197kc9awVlyoZ1OJKpS9cl2LSdslMtSZtRZVEAAV8WLJdoN6NvaiXdWXEgMJYLHoBRLowdvHq1LyOWs4MtSZadutsmlPdTDlzFVB2o0YU/+xKNw+Xn1eAQn04LztXWtvSZASg8UoBODXn75TVZsWk6iiccs+AlUWNU2WbQqRqU5P2S7tRvXerG0Zw1y24L1aFnUhKzZu2SeqaNJSU3i9RciRuln1BvI5q6CFP03ZLpkaX4HbLI7Xs9gQAqAifuLM+34tm7SYVCoRzrzvS8jRjXI2hCzZqGO35px1NrJsMT7toEUdy+cs+7+GAEiorcpCxfedkNZlm1Yjhu+EhG7gS6itO2bcqSCfs2wt6tjE8t4YKFrFYMJ2G7JoCAJLNqEbeI4TsiWWwFmy8BqxaBiyvNpXJuacwFCKiTknAF5pxKJhCIDSvBx6YTg96xJ64YLSvNzo3IYhS3vD0dKcixZ+3qjFXUEAThy2XtWK8ycOW6/ezTz1//iP/zdtWIg2XQyWRQAAAABJRU5ErkJggg==" }, base),
iconCroplandTripleIrrigated: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABZ5JREFUeNq8V2tsU1Uc/91H23VbtzG20THQ8dh4qyAGBlNBAgQMISoaPoCiH8wIjyghJuIDgx/giwZhhkBi2BdMgCAagoJKAgoDQ8iIuMirsne77sG63t6u7e29nv8ZrTT3ditmepL29tx7z+/xP//zP6eCYRj4r5tMX7bNC68bklAw4ui60abtv1QtkBP7xgXGuMkjz9F2t48uE2RGsEi3i0rpKGeuX4uOGEGJbEdztqJJqlZO4SoQ7FIuOfLGBkaMJEeQ4MyS5aiqLRINUZjvdMpQdZ0/3DbhWSibfkLrm0cx1/loIfx+2Ud8PLUIdLgcMuJZYrmo2wW3XRJTXn7r2CbUey7hOfes5L1SWxbqqt7OmFBjkXE4JYgx4ymRvnKzZYSMOH/4+b1fMW30JIwbNR6/+G4kB60pm401c17FnpmrMyKJsMi4bDIMEbkipa4oCqaXHit8LMVJWW4Jv25+fnNGJFEMhh8GIxE0o8BlkxDWB53snLoC9d7f0dLbwmKaawlAodtSXjWsKymHhUszxoiCbuQLLHYaBld+MKLg5Lo65Dnzcbr5Mr83m/0+6jmPgNrHP+fW1GL3i7sQiISGJElESLDVVBkz545BB0tfJa5ZvkwTvnTqUlxrvYavGo7hyNqD/H7FoVVDpv2TzjxcveoFTyunIKYloPbF9aP8+sKUJZhXOgMHLx7Cvgv7sHvu65nXLjUWR64kpyUqtGfjgzOfYlH5fKZKxIrpy1liPI7aC7VpgQmPcHnYdJvgGVA12CGmHbB++irUvvwZygrK+NwQATX6na4RHuHqstAhifPGz5NkaVZhngN98VjyJZpsQRCg6Bp+62zEG9NWYnJJBbp6WnD6zzM4fuM7PF08BRd7/7Ikcdsc6O2JQA3HTtFiPN59fyDqEiXIwj/rpSEcwIbyap6uy4sq8SWbBwpPa78XlaMn4uAre7F6xkrrOWA4hEe4hC9GD9R/i0jcUJm1PNGW8vLuOz9zoqkMdMey97D+mXU4230bSyoX8+dHrh9Put5Q+gReKprE+4QTCrGoMFzC5xNhSPix1a+iULKZVBGR21WCtvutyM8uwMaKJbjpu8kzrDi7EN8s3o7qMdNRxxbwyW4PH1Nks6OtK0y4X/OJ51+asTXYG9ayWKFxMptWKdzZ34maE++iS+3F7a47WDvnNYxiVXrTxVrsb7qcklUiS6pgj6ox3F18MSb2eHlr9U13cc4Ul9uB1mjYREQlpLK4Aq4sF6omLsD7pz9OAU+0yfYcdPvC8PmVS7T1Jp3wHzG9xt8Z0vMNmasxubl1FgsnLeQEh6/UWRLQOIqG36eQiw+T2MmqeaD+vC7iTltnCG7JYQKg8tHobURgIIAt145Ypy0bR+MNAY2EZyJJuvEpcVJj5cbP5qWhpSHtCk+4EOLGOym4KXsAY2cq/kjnZkCLoEftTuvC4w3SCj/3sAsTCc8EpoLUpHPjDfhM9wpY6ktsWQQ6Q5oY1WtMJd+0o9HcMDXNPsXkhmrXvUC7iWQsqwpNXgW6TSQXTZZV2MTM1PR4lXtji7K5ykRNW/rDTnOFluyIR3QEu1VSXGOJZ7k/MzXswHeW1JHKoRoVQu5CFk5ZuUhLknBD6kglqbXcZx52wapGWqy0pw2mip1kTpBKUjuMi8PpXAxJ8iDTtvf3hKNWbqg/EImDnjMX24Y8UAx5diI3snDgVnt/ihvaL6h/t6kf9Jy91/evSR5UgU8i9yPRcDDGTuqDRMXsSv2YEo3S82Exhj0JMpWk1tPB5ob9HbCxk00xS2vqZ+IiI5KEG6Y6EmTqKxw5CA66iGTiImMSrlbAXk97ULOx+aAr9TNxkTEJzzTd2BMLxeLN7QpiaixE/UzHZkzC50bCNn9HkP4O7MjUxeDJnm2/j/KRN1ZdedQxwv/xP/5vAQYA/3r0iklWnuMAAAAASUVORK5CYII=" }, base),
iconCroplandTripleRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHX0lEQVR4nLWXe3BU9RXHP/d3H5ub7GY3i5BNE0IIkkTeID4SgkUpUqoOWmnHP9CB2rEwoLXWaQdFbMEBp1ZHJTUDM7WMU5yJSON0hraI0IDJSgsMKQ95ZowmdTchgWyyr9y9ub/+gUlZ8jBO6Zm5M7t3z/l+fuf8zu/cvYqUkv+3aQD62nmNUlV8N1zdka321oZKRUqJsbpCFtx84xmtF7sAJmrG6ooFjiGieTmmu922bhhgnGbweWbUVuN2kQb4FEN1SykJpZI3DJKlqJgZmmbF7QVCCuVO09SIOw4Az0ycT3TNPlpW1jDX9I1KcK7pI7pmH9E1+2hY+goAvTh4XBp9GaJIOIYSMFSRFvSj99YQbGrgrsD0gXt5egY7yp8YEfbQH1cws2AWc00ftpS4TBWRkrOESMlZ7kyNmOwD4LXPPuaWMZMoyBnPofDJAYFl+bNZNucHvDxt6aiy63UcPLqGFLiFVBWfEMogp0J/YVom+e5xAKz99tphhWuX7+DQhUMcTXRhcbX8SNxCsaXPo6sknKuZvFi2hGDoBF9c/gKPyz2kWJ6ewZNF5YOyemX/a0zPnzbwXc1SEbbMFYojvYqpYnP15Pf0RqldvoNs08uezz8BYLbppaapjki8i0i8i/3Lqthy30YivbE0yJnOJnIy/Szy5gPQXyFFX1Uup83N5ctUkmifPeTKd5Q/waKyRRxrOcbvj7/Hzke2ATB5+wMjtv1MM5sjR0IIAFMRwwIA3misAeCe0oXckTeVbfXbefPgm2yZ+9iwMdeaBhBP9eFWtWFBfiOT5/+2iQVFdyIQLJmymEL/BKoOVg0r7FY14qmr+ywcXWlKxm0MxLABj055gKrvv0q+L5+apjoK/RMAqGmqGzbGQJCM2zia8qUA/tHVY+FVtTSn2aaXPD0DgHVH3yES76K8uIL7C+9k3Z4N/GT303y34LZhIV5Vo6vHAoU6IVJyV8eVpOURKpry3/NyPBFhRVEleXoGi28q4Xf126k6WEVLd4iSMcVse/h1lk793pAATVHwCJWOK0lLpOQuYVUHP6C3T8bjNtlCT3PecuEjVhRVUjammOfu/QWP3racvR3nWVhyNwA7G3cNZL0ibwYP3TQJgGyhE4uloLdPWtXBDwSAVPmwpT2OX02H9IMCnnG0XmnBm+lj9eSFnA2fZVv9dsZm+vnT3c9SmTuFHaET1HY0AXCTbtB6KYFUeRe4utvClk/1XE7YGVJgCnUQ6I3GGtq621i1+2dcil/m/KULPDLnh+SYPtbUV7G1+ZMBX7eqIfqgpzNuC1tuBFD6n/HaU5VnA2OzSj0BFy1WYhDo5WlLKRk7GU+Gh/LiCtbt2ZAm3m83G1l0hBOE26MN9taGyoFMAETKWdXeFnO8UsN9XacBvHFuL/MmzaO8uII/HN4xJMCtamRIQXs4agtbrh/Q7v9gVQfrHMGF1rYYAdU1SCCUSnI6dJpIMsKTx3YO+h0goLpobYshFU5b1cG6/vtpSxYpZ1V7OPpRQW6WOtQEaO9uI35dKf3h+Dk92ZcwhYo/UzE/bY9NUhz59LU+aRCrOlinr513qrUtNjMQMLl4HSRp99Ib7wBgVn24bkZDaI5uMzFbqAZAt9NnlSqye/lLv+kYFgKg9Mmn28PRfQW5WdpQ2YQiYRbXNP1zwoXIXbd7vCL3q7bPLi/GjsaNzxpb/LXP//L42b/v//Xj77z7EjB4YFnVwTpHU/Z/Ho4O2pt8Xz4X3959cFJTz633escMAACmvPhb5mx/n1xV5zvZfu3igf0v/HnTr5YMCQEQlrOqMxRFTYHvGqH7atdHrA//VT4ny6O6rhlB/kUzMCdMxY60A+BSFGZmZhkHtr31XiISUYaEWNXBZscQe5tDUb711ZAECDR3n3ULVc1VdVxF2WSXF5M5PcCUjW8BYE6Yyt1nzpG3fBG5qo6JYpxv+Dgw7HwXlrOqpyNOX6+D/+q+khOOJwr0DBWgbP0Gbn37rxQ8vAzdNzYtdtyCxQDkaYbReupk6bAQqzrYLFVld3MoSkAffG5GsstH6tMXPJKz0ief7e5MWP3ZxHyGdmkU/5eTbWEALtkWYwoLW0eEWNXBZqkp1ef+3U1Ad/FFmX96Z2+SqOOQ6u4CIBW5nBaT6rpEd+OnRB2Hzt4kM5fc36R83UuQsbrCJxWlrazEb8RMyc17mg7OOtZReY8nZ6DDXEXZZE0uIqu4mM7gYa6cCHEwGrHuWPn4Iw9u2lz7tRAA7anK140M/aezSnM40xtjWdXJ5pyu1Pj5Hp/qFunFiDoOwVi3lTl+fN0LnxxdDNeM+lFkEy4r8btMj06iJ8W4988cKL3YebtXM4w8zTAAQrZlJZDWgpU/fuzBTZtr++NHBQHQ18x7Wc/Ufz77ljHa8TOddiqeerV781/WnW/4ONB66mQpQMG06edK5s0Pm15vmuioIf3Z5Oa5XW3haERxZJFVHewaTeyI3XWtWdXBLqnyTPuXPUjBc6MFACCl/EaXtrr88DeNGXW5/hf7D/ZHUFUzok84AAAAAElFTkSuQmCC" }, base),
iconCroplandTripleRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHRElEQVR4nLWXa3BUZxnHf+97zp7NXpJsspCEEEgIbCNgLkLlouHSC3Sszqgto8wopRM+GMcZBXTGUVtdaz/wodZvVDu20BQ6ttSBoR0sqWRCLXJpGShDCTFAQgghkGQ5u7nsnrPn4odcyppL44jvpzPveZ7n9/zf532esyv279/P/3upAFv2Rs+7UoTue3TX7dq3NVqrAgiH6nCB774zYj3DpU+9Gi0TyiOR9Y4q3llUmhtM2NZ9A+QoKle6EpY0nA0qEBKqDOK66Hb6vkG8QqJ5FNUynPWqK1ilaRLDdQF4fHYFm2qeYMgc4sWTf6bdHP7cgAs0P8+u+wkAnbHrRM++gYVLlipJeESZdFVRpEqZ4fTyqT203W5lce688b2Q4qE+8vC0sD98+Efm55eyQPNjuy4eTSJst0YK263J0iSG6wBwpLeV4uxC8gNhWuI3xgOszC9jRdlKNpcsn9FxpV2XLEXBFQSlK0VISDHBKByclaEkz5sDwMbFG6cMvKO2nss9l2k3h7FwxraDUthuKEuRmKNKniiupu1uJ/2DfWR5siYNFlI8PDY7MkHVu58eYV7+Z4nJLIm0KZTCJVdoEpuRwqfSKXbU1uPT/JzrawOgTPNx6s4lkuYwSXOYX618mu/WbGLYMjIg3QO3CWgBKn15AAgxckJCeSTilpTnctc2MRyHyVZ95GEqiyu51t9Oc8cpfrR6GwA7m16Y9trP13xcu6ojATQhpgQAvHf9JABL5yxlUaiEY61NHG05yubyNVP63LtUANNy8Eo5JSigeHnzk4Msmb0IgaCmpIpwYBaNLY1TBvZKiWmNxJOOwtW0aaMip3RYU7KMp7/8PfL8+Zy6c4lwYBYAp+5cmiZ7Sdq0cRS6JXB6KGnh/4+GLNN8hBQPAH+59g+S5jCRgghfCkd48/zbvHLmdaryF04J8UvJUNICaJbS5sDAUNr0CZmhpcNMsnZ2BSHFQ1X2HBpbm2hsaaQ/qVMULGDbii08WFIzKUACPiEZGEqb0uaAbKiLHsJyXMNw8Ek1w/hwz0XWzq6gOFjANyu/wZqFtVwYuMUX5ywB4MT10+Oq14bm82B2AQA+qZIybLAct6EuekgCuJLG/oRBUCoTsjrcc5GQL4fYUD8+zc+jRUvp1rs51tpEthZgx5KvU5Fbwgd6Jx8P3AEgW1GJJUxcyRtjypA2P04NmpbHFWhi4gV47/pJ4sk4r5x5nQFziFuJHr6yYBUBLcCe1kaO9raN23qlRDqQGjQtafPcOKShLtrhSHE1FjfIVtQJkA4zSVvvFVbMrWZZcTUbF2/k8KUjvNZ+YkIzhqQHPW7gSE431EU7xiEjatz6RNxwfK7EKydRc+sCDxQ+QKQgwvErH2Rkf68KjytI6ClL2jwzHnvsoaEu2uwI2mJxg5D0TAig22m67t4kmU7yWvuJCe/HVMTiBq7g04a6aPPYfsbZSNutT+ipv+fnepXJJkAiGce0zYy9cCLd6kk7SY8QBDXhu6mnFgqX7ffaZEAa6qLNW/ZGL8biRnUopHHbyZyyaSdN2hj5sbHsykBz9bWBZZrDghxF1QAStmWuwk1UfPs7fVNCAITD9oSeej8/16tOpkYf1nn8bP+Zst7U2hXZIVk4OhVyVpdjDQ5r7edv5H908MC5RGvLbxdt+8HzwMSB1VAXbXYUcaxPT02oTZ4/H+fE2eOL+tLLN+bOGgcALPnNCyx7+W0KFQ8bcsPq8OWWZzvfOfS1SSEA0nLrB3UDaYH/ngZ98eO34sFLXauXBbMVr/jsk52/oQpf6VKs+EgzeoWgJhDUuo83vWUnk5N0HqN9o4qjvXqKvHuyLepPXQ5KVSlUPHjLcshZXY6/soglz+0GwFe6lIdaWpnz/Q0UKh78Qmp6W2vRlPNdWm59asDESbsERmdafiKdLNGyFIAvPPNrlr/6N0qe3IQnNDvDt2D9YwAUe7za0M2uiikhDXXRDlfy1149RWiSKTDdin30YWbC0xkLh58lB01zTM2gX1F7LXM6FwBSt3sA6LVMssLhrmkhI2rES7fuJgkpKp2F/sp+I8Wg45BO6ACk47EMn7TeS+L8JQYdh34jRbiy5urnnoO03Wh6KP1DM2lrXq+W+6+FuceDnXqtZ8fvFO/O5wHoPvgugUgZgfJy+v95ikR7nBODcbP0oUc3Kz6fO62SUTW6K8VLt0drc3JxaF1/lrjRlIjZg6ONanQkiL1/gRt/OsSdT7ppHtBNJy+ved63njwIk3T8VGrslFWfTNreIp+Xxq+WlEXO3W4a7OtbkaN4tGKPVwPoThvmsOuYc2vXPTUGABAz/c+4ZU90l+JVflo2N1vtuDlg2Yb9+72bf/4Lva21aOhmVwVAYG5JayhS0aP4fO69vjO+m8Jll23Y2/tiKdU27CHhskvx+dxwVc2tcFXNrWlPYqaQkdqwM3E3hSv5ZUNdVJ+p74whAPu2Rne7gtP7tkZ3/zd+M67J/7L+DQz7EUp8y+R+AAAAAElFTkSuQmCC" }, base),
iconCroplandTripleRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFlUlEQVR4nL2XXWgc1xmGn/PN7K5WK8kryZJtVa3VxoqxXdtqmtpJsU3oj1vaQCAEEiipw+ZGUAhJ6FXbi6E3yVXJVQylqZuNXRqS0uCAiVVsVBdjORSaBMdGyInWqWvrX7Mr7c7PzszpxUqq1rsrb4LbczUz5/ve5zx7ZmcYderUKf7XwwR4+g/WB1pU+p6na33z5DHrkAmgIvZ39ybvOWNhqrT9p7+3BpTx3cFHIlO9u2P7prZCGNwzQIdhcv1mIRAv+r4JpJUpbWiNHZbvGSShhHjMMAMvesTUioficcHTGoAf9ezkiaHHKfpFfnPpd0z6pS8ECdC0mEIhpgZEm2qrKVJV8NuxE0xMj7Nr05fXrqWNGMOD32kaEmpNLC6oUA+JCvVQS1zwdATAmdlx+tq30JXq5lr+X2tNB7sGODBwkKf6v9kUpKw1LYaBVrSJFpVWomqKuts2V5l0JjoAOLrraFOQgGj1sE1UqNMthuCvmDzet5+Jxc+YX56jJdZSNyBtxPhBz+BdraRFkJAtojSbVFwIqWy8W3Z54dAwyXgr/5ybAGAgnmRs5iqOX8LxS/zy4DM8OfQEpcDbEKJU5Rcy159AZU/O/PWlquIfbn+YvX17+XR+ktHcGD97+FkALsyONwR4UUTcrOQKQFwpvChq2PDejUsA7Nm2hx3pfs6Nn+fstbM89bXDG5qsDhPADyISIg1BKSPBmx/+hd09O1Aohvr30Z3azMi1kYbBCRH8oJInkcEnZT/ERBo2HO5/gGe+9RM6W7sYm7lKd2ozAGMzVzdYvVD2QyKDWwJcLjoBrXf8IQfiSdJGDIA/ffp3HL/EYO8g3+ge5M0P3ua1999gX9d9DSGtIhSdAGBUJOStpWLZTyqpcsn5Dkd6dpI2Yuxr38bI+HlGro0w79hsbevl2QNP82D/UF2AAEklLBXLvoS8JdmM9Q5BpD0vIilmVfHpqSsc6dlJX1svj+19lMP3HeKjpdt8fdtuAC7euLxmfST9FR5s7wUgKSauF0IQ6WzGekcAtDAyX/BoE6NmVaenrpBOdrBQnCcZb+V7W/dwy77FufHztMdTvLD7x+zc1M8F+zP+sTQDQLthslDw0cIfV82QkOfcZT+IaUVc1d4A7924RN7J89r7b7DkF7ldmOLbX32IVDzFifERzs5OrNUmRJAI3GU/kJBfr0GyGSsXifpkIe/Rbpg1kJzvMDF7nQNf2s8Dffs5uusop6+e4fXJizXvoLTEsPMekXA5m7Fya5CKjR4u5L0oqYWE1LG5/RH3b7mfwd5B/nb9QtXq11vEtKJgu4GE/Gote/Ugm7FGI8XEQt4jLbGaADssc3Px3zhlh9cnL9bMr1os5D204uNsxhqtgazZ2G4Y06quTcHJk5vP1QWst1ARz1flrj/JZqxRrbjSyKYclVnylhpazNgukaHOrbeogQCoiOcLths0srFLds21VjGQAEp5L5BAD985X5OSzVijkaHOzdlujU1naxezzmINpNOIMftfi9yd87X3KyCBHl62vcnO9gStYlCKQgBe+vDtmtqUmERljbvkI1BjUddkxSYXmersrO3SadTuzfqRNswVC96tZ9EQsmrjLvlEZU1K6gpXW4Q81zCr0UQ2Y+W08OdZ2yVd5ylwh8WJRhYbQgBUxM+dZd+vZ5MSk3I5wln2fQl5caOcDSEVG3X89qJTZSMrFlNzDlrU8WzGsr8wBEBCbZWLZd93QjpWbDqMGL4TErqBL6G27ppxt4JsxrK1qOPTK3tjoOgQg2nbbcqiKQhUbEI38BwnZGssgVOx8JqxaBqystpXphedwFCK6UUnAF5pxqJpCIDSvBx6YTi34BJ6YVFpXm62t2lIZW94sbDoooVfNGvxuSAAJ49Zr2rF5ZPHrFc/T5/6f3zH/wfElocgjJ4IBwAAAABJRU5ErkJggg==" }, base),
iconCroplandTripleUnknown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFSklEQVR4nL2XXWxUZRrHf+9zzsx0Om2ZglRgG+kuFCIIVFdBjaBxd9FkTTbZmGhiEDN6QWJilHilXpx4I5deyZVfIxiNrhpMDDSBVDZEMHshBCENIINBKC1tz8y0PR9z3vN60Q9bZqYdFfe9Omfe5/3/nt95z0dG7d+/nz962AA73nO+M6KyNz3dmMv7djoP2AAqZtOSjvRNZ4wMTKx8+h2nS1l/634ottWXq1cuainp6KYB2iyb85dLkQTxP2wgq2xpwRhcXblpkJQSkgnLjoL4ITGKe5NJITDmdwf/e8Umnlv1IAARhiZbiBOqS4ytltkiCwZkrQS7uh9uGKiNIZEUlDY9orTpaUoKgYnnXbRlcRebu7bwZOdfG4JUjKHJsjCKFjGiskrUgovaU20AbL99e0OQiJmmW0Rpk22yhHABk9kjayV4ZGn3glbSJIjmVlGGRSopaOpvfFcyzfHBM3jhBF44watbnuGJnseZiIJ5IUpNXiF79km98ejK+9iwYgM/DF+kr3Cc5+97FoCjQ/1z6j67cnLmOIhjkvZkrgAklSKI61+ug5e+AWD98vWsznZyuP8Ih84e4sm/bJ23uelhA4RRTEqkLihjpfj45OesW7oahaKncyNLMrfQe7a3bnBKhDCazJPY4kIl1NjUf1a2dt7FM/c8RXvzYo4PnmFJ5hYAjg+emad7oRJqYosrApwY9yKab3ggu5JpslYCgI9++C9eOEF3Rzd3Lunm4+8+5e1vP2Dj4lV1Ic0ijHsRQJ+I5pPyeCVMK5njUgg9ti1dS9ZKsLF1Ob39R+g928uw57KspYNnN+/g7s6emgAB0kooj1dC0Xwi+ZzzBVFsgiAmLfac4gMDp9m2dC0rWjr414bH2LrqAU6Vr3LH8nUAHLt0YsZ6W/Y27m7tACAtNn6gIYpNPud8IQBG6B0uBbSIVdXVgYHTZNNtjIwPk0428/dl67niXuFw/xFakxleWvdP1i7q5Kj7I/8rDwLQatmMlEKM8OG0GaJ5wR8Lo4RRJFX1DXDw0jcUvSJvf/sB5XCcq6UB7v/zvWSSGd7t7+XQ0LmZ2pQIEoM/FkaieX0Gks85hVjUhZFiQKtlV0EKoce5ofNs/tMm7lqxie23b+fAma94/+Kxqm9QVhK4xYBYOJHPOYUZyKSN2VUqBnHaCKkar/6DV0+x5tY1dHd08/X5o3O6n22RMIqS60eieW0me/ogn3P6YsW5kWJAVhJVAa6ucHn0J7yKx/sXj1XNT1uMFAOM4vt8zumrgszYuL5OGFXTpuQVKQwXagJmW6iYF+fkzj7J55w+ozhdz6YSVygH5boWg65PbKnDsy2qIAAq5sWS60f1bNwJt+q3ZrGQCCaKQSSR2XXjfFVKPuf0xZY6fN31q2zamxcz5I1WQdqtBEO/WBRunK++XwGJzK4xN7jY3pqiWSwmYg3AGyc/rarNiE1cMfjlEIEqi5omUzaF2FaHhlyfdqt6b2aPrGVPWfBlLYu6kGkbvxwSVwwZqSk810LzQt2sehP5nFMwwn+GXJ9sjbfADRbv1rOYFwKgYl72xsKwlk1GbCqVGG8sDEWze76ceSGTNmrv1VFvjo1MWQxc9zCi9uZzjvubIQCijVMZr4Shp2mbsmmzEoSeRvtRKNo4C2YsVJDPOa4Rtffa1N5YKNrE4prrN2TREAQmbbQfBZ6nWZZI4U1aBI1YNAyZ6vbNa6NeZCnFtVEvAt5sxKJhCIAy7NGB1tdHfHSgx5VhT6NrG4ZM7g27S6M+RnilUYtfBQHYt9N5yyhO7NvpvPVr1qn/x//4nwGQ2GWYPJBhngAAAABJRU5ErkJggg==" }, base),
iconCroplandUnknownIrrigated: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABU1JREFUeNq8V1tsFFUY/s7M7G637dKltqWlXirQgkUNoKYUmgg2SMAYolblQZT4YNoIqISYiEYUH+DFBKGGQGLoCyZI8BJCACMJJAXxgZSojYVSKbRlt9sL3e7ubHd3dsbzn7Irm9nZDlqdZHfmzMz5Lv/5z3/OMMMw8F8fCv05Ni2/bMjMO+3outGv7TvfwMiJs2WZcf+86efovzZGp4cVTrBCd0rhipnuwoAWnzaCMsWJG/lhTVa1KgqXlznlQnLkS0xMG0kBk+HOU5S4qq2QDIktdbsVqLr+r4F3LFiDg3VviusYdHhcCpJ5UpWkO1m5U5amBKhw5KGt/i3bhBqPjMstQ0oYiyT6K8xXEDGSOTs1VS5G05KXsfvRdbZIYjwyHocCQ0KhRKkrSWzKTpWFZeK86elNtkjiuBN+g5MwzfB6HDKietJ2KCh0m6vqp3QlF/BwacYsielGEeOx02A98xe7i3Ck5yyC6pj4nWlqxa7ndiIYi+QkSUVISTdyGHln0atYtWAVLvVdwlcd3+Dw+gPifltve8Z7n3adTF+HkxrczsmEEv9uJombVscXl4+I8zPzG1FXsRAH2g9i77m92PXk6/Zrl5pIolBWLImKnfn48NRnWFG1lKuSsKZ2NR4sfgit51otgQmPcIUT3cF6JlQNTljPlQ21z6P1xc9R6a0UY0MEdNC11UF4hKsr7JYs1T1QJyvyY8UzXBhLJjIGmzGGsK7hl8FOvPHIWswrq8bQyE2c+OMUjv72A54onY/20T+zkpQ7XBgdiUGNJo7TZDw6fHsi7pFkKOzv+dIRDWJjVYNI19UlNfiSjwOFp2/ch5r75uDAS3uwbuHa7GPAcQiPcAlfiu+/8D1iSUPl1mZIjoyXd3X/JIgWcNDtz76PDU+9htPDV9FYs1I8P3z5aNr1xorH8ULJXNEmnEiER4XjEr4YCEPGj30BFcWyw6SKiMo9Zei/3YeifC9aqhvR5e8SGVaaX4xvV25Dw6xatPl+xXfDPaJPicOJ/qEo4X6dTmE+K7eERqNaHi80bm4zWwoPjg+i+dh7GFJHcXWoG+uXvIKZbi/ebm/Fvt6fM7JK4kkVGlE1jruT7rHUGq9saegqLy2Y7yl3oS8eNRFRCakprYYnz4P6OcvwwYmPM8BTxzxnAYb9UfgD4fO09KadiIuE3hwYjOhFhiLUmNxcOY3lc5cLgkMX27ISUD+KRsAfJhcfpbHTVXP/hbO6hO7+wQjKZZcJgFbNTl8nghNBbL50OHva8n7U32DoJDwTSdqNP5wkNdncBPi4dNzssJzhKRcsabybgZuxBnB2ruJ3KzcTWgwj6rClix5fiGb4mbtdmEhEJnAVpMbKjS/oN93z8tSX+bQIDkY0Ka43m0q+aUWjseFqbvjDJjdUu64HB0wks3lV6PWFoTskctGbtQqbmLmaEV/4+uySfKEyVdNWndxhrtCyE8mYjtCwSoqbs+JlXZ+5Gr7hO03qSGWugwqhcKGw49lcWJKk3JA6Uklqs64zd7vgVcMSy3K3wVXxncwxUklqp3BxyMpFTpI7mbZtfCQaz+aG2hOxJOg5d7E154Yi596J3Chs/5WB8Qw3tF5Q+1rvOOg5f2/sH5PcqQKfxG7H4tFQgu/UJ4lK+ZnaiXA8Ts+nxJhyJ8hVktqeW3xs+OeAg+9sSnlaU9uOC1skKTdcdSzE1Ve7ChCadBGz48I2iVDLsKdnIKQ5+HjQmdp2XNgmEZmmG7sTkUTyxkAYCTURobbdvrZJxNjI2Bq4FaLPge12XUzu7Pnyey8/paX+4r32Yf/Hd/xfAgwA3pDQ63Vj/WsAAAAASUVORK5CYII=" }, base),
iconCroplandUnknownRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAG+klEQVR4nLWXa2wU1xXHf/fO7KzXXnvXa7ANGLCDNxZQP+IkQFIeeUGVtFLTNmpRK0K0SI3VSi2kkao+qDZRPlCpbaR+SKpKaYgDUROIQKRKwBTXJEU8EpqUgo3Ly6bGNvjBeNf27szuzO0HY8sbe43b0vNpd/ac8zv/e+85c1fs3r2b/7fpAJt2Rj9TUgTveHalunZtjq7WAYRLbVGx744zBntHFz/9h2i50B4NP+Tq4r3KxQF/zEnfMUCBpnOxK5aWlrteB4JCl36UwnRSdwziFRLDo+lpy31IV4JVhiGxlPqvE1YYuWxf90MArg52Ej39FmkUObok5hHlUumiVJfytomCmoeG8CMz+rz819+xKLSYCiMXRyk8hkQ4qk4KR9XlGBJLuTMmWBkqZ0X5SjaW3TsrdSmlyNE0lMAvlRRBIcVtgwq9BQBsWLohq8+21Q2c7z3PFXuUNBNF+6VwVDBHk9i3UTLZgpqHL80NT1H1p3PvszC0cOK7zJFIhxIpFAFhSByyb3y54ePEjVYS9igJe5SfrXyGb9U9xWjayvDrjl8nz8ij2lcIgBBjKyS0R8Oq7K4ANx0by51eTUP4EarnV3N54AotHSf4/gNbAHiu+VczHvtFho/Ll0wkgCFEVgDAwc7jACyft5zKYBlH2ps51HaIjXetyRoz2XQAO+3ilTIrKE/z8vbf97FsbiUCQV1ZDUV5c2hqa8qa2Csldnosn3Q1LqVsB53svbKmrJ5n7v8OhbkhTtxopShvDgAnbrTOUL0kZTu4Gt0SODmSSJP7uYYsN3wENQ8Af7z8EQl7lHBxmHuKwrz92V5eO/UmNaElWSG5UjKSSAO0SOmwJz6Ssn1CZmjpsBOsnVtFUPNQkz+PpvZmmtqaGEiYlPqL2bJiE/eV1U0LkIBPSOIjKVs67JGNkeh+0q6yLBef1DOcD/SeZe3cKub7i/lq9VdYs2Q1Z+I9fGHeMgCOdZ6cUL02uIj78osB8EmdpOVA2lWNkeh+CaAkTQMxC7/UplR1oPcsQV8BgyMD+IxcHitdTrfZzZH2ZvKNPLYt+zJVgTI+NK/ySfwGAPmazmDMRkneGleGdPhBcthOe5TAEFMPwMHO4wwlhnjt1JvE7RF6Yr08WLGKPCOP19ubONR3YcLXKyXSheSwnZYOL05AGiPRDleKS4NDFvmaPgXSYSe40HeRFQtqqZ9fy4alGzjQ+j5vXDk2pRmD0oM5ZOFKTjZGoh0TkDE1qiE2ZLk+JfFOM/oP9pzh7pK7CReHOXrxw4zqJ6vwKEHMTKalw88nco9/aIxEW1zBhcEhi6D0TElgOim6bl4jkUrwxpVjU34fVzE4ZKEE5xoj0Zbx5xlrIx3VEDOTfw4FvNp0EyCWGMJ27IxnRbFUuyflJjxC4DeE75qZXCIUWyf7ZEAaI9GWTTujZweHrNpg0OC6mzllU26KlDV22ai/GG+pvRyvN1wqCjTdAIg5aXsVKlb1tW/2Z4UACJetMTN5OBTw6tOpMUdNnjg9cKq8L7l2RX5QlmgZS2tcd1Khj/ft+TTW3vZC5ZZnXwKmDqzGSLTF1cSRfjM5ZW8Kc0O4x04frexP3bshMGcC4C0vILS+hoXPPklF3ULWB4r00fNt26++t//xaSEAMq0ahk0LmYbcSQ36m0/eGfK3dj1Q78/X7nl5Ow+3tVOx7ds8+MHH1P52D5Vbf0n97/dSUBGgLs9vdB9tfsdJJKbpPG71jS4O9ZlJCictR+lA8rxf6lqJ5sFTEATAEwhlxHqCcymoW0aJ5iFXSMO80F6adb7LtGpIxm3clCLv1kwLxVKJMiNn6uz5nOWUlAIw3+M1Rq51VWWFNEaiHUrybp+ZJDjNFJjJQvevzix4Jmfh8nxi2LbH1QznanpfeqxPzr/0Iqcjj9P17l5SZl9G3I2WQwD0pW1yioq6ZoSMqRGv9txMENR0rpbkVg9YSYZdF6sjRuz4ZUb/0UvrL74HQKLzHH9ZWkXPrsMMuy4DVpKi6rpLt72fSkdFUyMp2044eL1G4J9LAkc/ipvO5Lvz4OEzJDrPoQfG3ieWUhwbHrIXP/zY1zWfT90W0hiJmkqKV6/f2pvjS4PrBnLEv5pjg87wpEZtfeF5/vbdpxh2XVripu0WFrYsfPIb+2Cajs+mxkmmGxIJx1vq89L0xbLy8KfXm4f7+1cUaB5jvsdr0HyW7pRljyrXXrB63dPjAAAx2/+Mm16P7tC82o/KF+TrHdfiacdyfr1z449/Yl5oLx251lUFkLegrD0YrurVfL6M6+isz6ZQ7HAsZ2v/YFJ3LGdEKHZoPp8qqqnrKaqp65lxJWYLGdsbnovdTKIkP22MRM3Zxs4aArBrc/QVJTi5a3P0lf8kbtZ78r/YvwEkkfYw7SrA5gAAAABJRU5ErkJggg==" }, base),
iconCroplandUnknownRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFg0lEQVR4nL2XX2xb1R3HP+d3r69jO0mdlIa2C20KNRXt2mbAWja1HYJRHjaJF6QhTVBkXiJNYlDtaX+kq72Mh0nwRPfCGKZFQzANlQm1kVplQEWLNglQaan6Jy4qbf40ybWd+P7xvffsIWmW1HZiUOE8+fr8zvfz+/iccyWrQ4cO8W0PE+DJv9mfaFHZW56u9ZWD++xdJoCK2b6yJ3XLGZMj1fVP/dXuU8bDuQdjU727cf2K9nIU3jJAp2Fy4Uo5FD9+xASyypR2tMaJarcMklSClTDM0I8fNLXiAcsSfK2/ceAGK80ffvJrAL6cvIz93zcI0bSZQjmh+kSbarUpsmxQ1kgwkHtoyZoXP/wL67rXs8FKE2lNwhJUpPtFRbq/zRJ8HS8ZsLO7jx19O3mi976W7Gpa02YYaEW7aFFZJWrZRV3JTgD23rO3ac3zuwb4YuQLhoMqIfNNt4uKdLbNEIJlTBaOrJHg0VW5Oqt/ff4ed3TfMf8sbYJE3C5Ks0JZQkTzje+zUpwcO4MbVHGDKr/b+TS/6H+caugvqrtaGSVjZdia6gJAqdlfSBkP53TvnSuYigL8uLHNQO4htq7dyqWJYYaKJ/nVj54BYP/xPy957NdZKS5ddBAAS6mmAIAjlz8CYMuaLWzM9nLs3HGOnj3KE3fubrpm4TABgjAmKdIUlDGSvPnpP9m8aiMKRX/vNlZmbmPw7GDT4KQIQTibJ7HBxVoQYdL8ruzuvZenf/hLutLdnBw7w8rMbQCcHDuzRPdCLYiIDa4KcGrGDUnfdCH7rBRZIwHA3y99gBtUyfXk+MHKHG9+8javfPw627rvagpJizDjhgBDIhFvVWZqQUrJIpdi4LJn1SayRoJtHWsYPHecwbODTLgOq9t7eGbHk9zf298QIEBKCZWZWiARb0khb79DGGvfj0mJuaj48Mhp9qzaxNr2Hh7b+nN237WLzyrX+P6azQCcuHxq3npPdh33d/QAkBITz48gjHUhb78jAFoYnCj7tItR19XhkdNkU51MzkyQstL8dPUWrjpXOXbuOB1Whuc3/4xNK3p53/mS/1TGAOgwTCbLAVp444YZEvGsNx2ECa2wVP0BOHL5I0puiVc+fp1KMMO18gg/3vAAGSvDq+cGOTp+fr42KYLE4E0HoUT8cR5SyNvFWNTFyZJPh2HWQYqBy/nxC+z43nbuXbudvffs5fCZ93ht+ETdZcxKAqfkEwunCnm7OA+ZtdED5ZIfp7SQbPDqP3LtM+6+/W5yPTn+feH9Rd0vtEhoRdnxQon4/Xz2jQ+FvD0UK85PlnyykqgLcKIaV6a+wq25vDZ8om7+hsVkyUcrPi/k7aE6yLyN40UJrRralN0SxYliQ8BCCxXz3KLchQ+FvD2kFaeb2dTiGhW/0tRizPGIDXVsoUUdBEDFPFd2vLCZjVN16r5Li4GEUC35oYR64Ob5upRC3h6KDXXsuuPV2XSluxl3p+ogXUaC8f9bFG+erz+vgIR6YNrxh7s6kqTFoBpHAPzp07frajNiEtc0XiVAoM6iocmcTTE21dFxx6PLqN+bhSNrmHMWvNvIoinkho1XCYhrmow0FF5sEfFs06xmE4W8XdTCP8Ydj2yDt8BNFq82s1gSAqBifuNOB0Ejm4yY1Gox7nQQSMT+pXKWhMzaqAPXptxFNjJnMXLdRYs6UMjbzjeGAEik7dpMLQjciM45m04jQeBGRF4YSKTtZTOWKyjkbUeLOjA6tzcGik4xGHW8lixagsCsTeSFvutGrE4kcWct/FYsWobMdfvS6JQbGkoxOuWGwEutWLQMAVCaFyI/iq5PekR+NKM0L7S6tmXI7N6wvzzloYXftmrxtSAAB/fZL2vFqYP77Je/zjr1XfyP/x84IoAQe9bCuQAAAABJRU5ErkJggg==" }, base),
iconCroplandUnknownRainfed: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABXdJREFUeNq8V2tsU1Uc/91H23VrWZnb2BjqBDaQhwJiYLBEcJlEjCEoKh9A+WRGeKiEmIhGDX6AhGgQRggmhn0QEyCIhhCZugTIUEwkI+rCY1QG22jXrWNd29u1vb3X8z9bK/X2doVMT3Lvueeec36Pc/7nnHsFXdfxXyeZbpbNSy/rkuAad3RN71b3X6gVyIl14xJ9yvTx5+i+MUjZYzIjWKZZxVD5RLvDp8bGjaBUtuJWfkiVFLWShsslWCUHOfLEh8eNpECQYM+T5ZiiLhN1UVhst8tQNO2BARfaXQht+pFfF1bt4e+i0OC0yUjkiZWiZhXKrJI4JlC5JQ9NNW9mbbP6qw14cso8TqqykbHZJYhxfZ5IN0e+jLCeyAqwpmI+1ix4BbvnrMrJXZSNjNMiQxfhECl0RVEYs1OFo5Tnm5/ZbNrm5LomnO84j98ig4hhdPh1RiKoustpkRDREjnPAQ3dlsoag6s9LZ9hbsWcVFkqYMOl6pNEQdMLBTZ2KsxX/nx7IY66zyKgDPKrZU0jdr2wE4FoOK3dFb8bE/OLUF9YwcvJEZJThSxG3pr3Gupn1uNS1yV82XYMR9Ye4u+bOlt5TsPjOFDPn4+N5pTs1pGA4ne7ICKUUE1JPr98lOfPzqjDovLZONT6Bfad24ddC1/Pfe9S4gk4JNmUqMiaj/fPfIJllYuZKhHPz1qBR4oeReO5RlNgwiNc7kSzCO5hRYUV5mtl/awX0fjSp6hwVfC5IQJK9GyWCI9wNVm4I4mLHl4kydLcogk2DCbiaZMtCAJCmopfe9vxxuMrMb20Cn3+2zh95QyO//EdniqZgdaBvzKSlFlsGPBHoUTip2gxHu+/OxxzihJk4Z/10hYJYENlLQ/XFcXVOMDmgYana8iD6oem4tDLe7Fq9srMc8BwCI9wCV+MHfz5W0QTusKsTRAtaY13dfzEiWYy0B3PvYv1T69Dc/911FUv5/VHLh9Pud5Q/gRWF0/jZcIJh9moMFzC5xOhS/ihy6egSLIYVBFRmbMU3Xe7UJjvwsaqOlz1XuURVsLWxDfLt6N20iw0eX7HyX4371NssaK7L0K4X6dCmK3KrcGBiJrHNho7s5kphHuHetFw4h30KQO43teBtQtexUS2EW5qbcT+zl/SokpkQRX0KyrD3UnvhOQZL2+tvVpWUjDDWWZDVyxiIKItpLqkCs48J2qmLsF7pz9MA0+m6dYC9Hsj8PpCF+joTTnhD3Gtwdcb1gp1masxuLnWjKXTlnKCwxebMhJQPxoNnzdELj5IYScf2ASd1UR0dPeGUSbZDAB0arZ72hEYDmDLpSOZw5b1o/66gHbCM5Ck3HhDCVKTyY2PzUvb7TbTFZ50IST0t9Nw7y0QO1Pxp5mbYTUKv9Jv6sLtCdIKb7nXhYGERwJTQWrM3HgCXsM7Fwt9iS2LQG9YFWNaw7/rDSR8bpiaW96QwQ3tXTcDPQaSyWxX6PSEoFlEctGZcRc2MDM1fk/o5uTifK4yuafVf/+RcYeWrEhENQT7FVLckBEv00tSwz74mkkdqcyWaCPkLmThVCYXpiRJN6SOVJLajOfMvS7YrmGKZVZBqtiXzAlSSWrHcHHYzEVWktFI2z7kj8QyuaHycDQBqmcutmXDyUrC3cjCwWs9Q2lu6Lyg8o3OIVA9azf4wCSju8DH0bvRWCQYZ1/qI0QlLKdyPBSLUf2YGGM1IJWk1n2HzQ37HbCwL5sSFtZUzsVFTiRJN0x1NMjUV9kKEBxxEc3FRc4kXK2Ave6eoGph80E5lXNxkTMJjzRN3x0PxxO3ekKIK/EwlXPtmzMJnxsJ23x3gvQ7sCNXFyNf9uz4vZ9L3lhz8X77CP/Hf/zfAgwA63XjaZP4vsgAAAAASUVORK5CYII=" }, base),
iconCroplandUnknownUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAGzklEQVR4nLWXe3BU1R3HP/fcx2aT3exmeWTTBIgBEsozYFXysAWpUqodbKUtf6CDY6eFikhbpw6KtAUHnE6dEUndgelYxhmdSZHiOKUtVmgyJittZUgF5JlpbFJ384LsZl+5e/ee/iGJCckmcUp/M3fmPs7397m/3znnd85RpJT8v00D0LfUtEhV8d5y77bssPY31ypSSozN1bJkzq1ndFztA7hNMzZXr7ANESsqcLq6LPOWAaZrBh/nxiw1YZVqgFcxVJeUklA6dcsgeYqKM0fTzIS1QkihLHc6NRK2fcsAAAPYuB0amRxRKmxD8RuqmFBUpOdwqOr7k4ZYUuJwqoi0rBQiLStduRpxmRlXtK54KeuWfZsXFq6dFGTAtnHrGlLgElJVvEIoE4qKXdMB2PKVLZOCmNxIv8QlFEt63bpK0h4/kuFWpOfwRGnVhFGpeSrCkoVCsaVHcapYZJ/5S50e6lsbiCT6iCT6OLGujr337yIyEB8XMpghMfwhmz1Z+V3+sP43nG4/zQ/ffpqZvlkAHGpryqqJZSycivgM4lQEsYyVVbCvpR6AeypWcVfRAg40HeTlxpfZ+6VHxv25QdMAEukMLlXLCvIZuTz7592sKF2OQLBm/mpm+mZR11iX1bFL1UikP+1nYetKayphYZB9rjw8/xvUfetFir3F1Lc2DKWrvrUhq8ZAkEpY2JryiQD+1tdv4lG1EY2WOj0U6TkAbP/gNSKJPqrKqnlg5nK2H9vJD45s42sld2SFeFSNvn4TFBqESMvDPddTpluoaMpnA+BMMsLG0lqK9BxWTy3n100HqWusoz0aonxKGQceeom1C74+JkBTFNxCped6yhRpeViYgeBbDGRkImGRL/QRjfdeeZeNpbXMm1LGM/f9lIfv2MDxnsusKl8JwOsth4ei3li0mG9OnQ1AvtCJx9MwkJFmIPiWAJAq77R3JfCpIyGDIL97Oh3X2/Hketk8dxUXwxc50HSQabk+fr/yKWoL53Mo9CFHe1oBmKobdHQnkSpvwOA8seTW/mtJK0cKnEIdBdrXUk9ntJNNR35Ed+Ial7uvsH7Zdyhwenm8qY79be8PtXWpGiID/b0JS1hyF4AyuMZrW2sv+qflVbj9DtrN5CjQCwvXUj5tLu4cN1Vl1Ww/tnOE80GbY+TRE04S7oo1W/uba4ciARBpe1NXZ9z2SA3XTSMNYN+l49TMrqGqrJrfnjo0JsClauRIQVc4ZglL7hjyPXhjBoINtuBKR2ccv+oY5SCUTnE+dJ5IKsITp18f9R3Arzro6IwjFc6bgWDD4PsRvyzS9qaucOzdksI8dawK0BXtJHFTKn3hxCU9lUk6hYovV3F+1BWfrdhy2/A2IyBmINigb6k519EZX+L3O7l6EyRlDTCQ6AGgsincsLg5tEy3uC1fqAZA1M6YFYqMbnj+lz1ZIQBKRm7rCsf+UlKYp40VTSgSZnV9699nXYl8+U63RxTeGPb5VWVYsYTxr5Z239Fnnz5z8a8nfvHYa288D4wuWGYg2GBryomPw7FRfVPsLebqq0caZ7f2336fZ8oQAGD+z37FsoNvUqjqfDXfp109eeK5t3f/fM2YEABh2pt6QzHUNHiHObr/6I6I+c4/q5bluVXHsBLku3cxzlkLsCJdADgUhSW5ecbJA6/8LhmJKGNCzECwzTbE8bZQjC/cKJIA/rboRZdQ1UJVx1GaT35VGbmL/Mzf9QoAzlkLWHnhEkUb7qVQ1XGiGJeb3/Nnre/CtDf19yTIDNj4Pu1XCsKJZImeowLM27GT21/9EyUPrUP3Thuhnb5iNQBFmmF0nDtbkRViBoJtUlWOtIVi+PXR82Y8u/aPkcvyuLs6JSOfivYmzcFo4l5D657EfjnVGQag2zKZMnNmx7gQMxBsk5oSuPSfKH7dwb/n+Rb1DqSI2TbpaB8A6ci1EZp0XzfRlo+I2Ta9AymWrHmgVZnoEGRsrvZKRemcV+4z4k7JnGOtjZWne2rvcRcMjTBHaT55c0vJKyujN3iK6x+GaIxFzLsefWz9g7v3HJ0QAqBtrX3JyNGfrKwo4MJAnHV1Z9sK+tIz7nZ7VZcYmYyYbROMR83cGTMannv/g9UwrNRPIprwvHKfw+nWSfanmf7mhZMVV3vv9GiGUaQZBkDIMs0k0lzx6PceeXD3nqOD+klBAPTHa17Qc/WfLP3iFO3MhV4rnUi/GN3zx+2Xm9/zd5w7WwFQsnDRpfKau8NOj2eE00lDBqMpLHI5OsOxiGLLUjMQ7JuMduKDyQ0zA8E+qfLjrk/6kYJnJgsAQEr5uS5tc9Wpz6uZdLr+F/svdooUc+NYbTMAAAAASUVORK5CYII=" }, base),
iconCroplandUnknownUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFNUlEQVR4nL2XW2wUVRjHf+eb2d1uty1bkArYSFUKEQTqDdQIMV7QRBNfTDQxCllfSEyMGp/Uh4kv+uiTPHlbwWjUaDAx0ARSMUQwPoBBSAPKYhBKS9vZ3bZz2TlzfOjFlt1tV1M9TzNzzvf/fb85M7NZtW/fPv7rYQM895FzwojKLnq6MRf37nTutwFUzOZlHelFZ4wMTKx+/gOnS1kPdT8Q2+rbNauXtJR0tGiANsvm3MVSJEH8iA1klS0tGIOrK4sGSSkhmbDsKIgfEKO4J5kUAmMWDQAQYWiyhTihusTYaoUtsmBR1kqwu/vBhiHaGBJJQWnTI0qbnqakEJh43qKtS7vY0rWVZzrvbAhSMYYmy8IoWsSIyipRCxa1p9oA2HHrjoYgETNNt4jSJttkCeECJrNH1krw6PLuBa2kSRDN9aIMS1RS0NTf+K5kmmODp/HCCbxwgje27uLpnqeYiIJ5IUpN3iF79km98djqe9m4aiO/D5+nr3CMF+99AYAjQ/11a4I4JmlP5gpAUimCuP7tOnDhRwA2rNzAmmwnh/oPc/DMQZ65edu8zU0PGyCMYlIidUEZK8XnJ79m/fI1KBQ9nZtYlrmO3jO9dYNTIoTRZJ7EFr9VQo1N/XdlW+cd7Lr7Wdqbl3Js8DTLMtcBcGzw9DzdC5VQE1tcEuD4uBfRfM0L2ZVMk7USAHz2+w944QTdHd3cvqybz098yfs/fcKmpbfUhTSLMO5FAH0imi/K45UwrWSOSyH02L58HVkrwabWlfT2H6b3TC/DnsuKlg5e2PIcd3X21AQIkFZCebwSiuYLyeecb4hiEwQxabHnLN4/cIrty9exqqWDJzc+wbZb7ueX8mVuW7kegKMXjs9Yb8/eyF2tHQCkxcYPNESxyeecbwTACL3DpYAWsaq62j9wimy6jZHxYdLJZh5esYFL7iUO9R+mNZnhlfWPs25JJ0fcP/i5PAhAq2UzUgoxwqfTZojmJX8sjBJGkVTVD8CBCz9S9Iq8/9MnlMNxLpcGuO+me8gkM3zY38vBobMza1MiSAz+WBiJ5q0ZSD7nFGJRv40UA1otuwpSCD3ODp1jyw2buWPVZnbcuoP9p7/j4/NHq36DspLALQbEwvF8zinMQCZtzO5SMYjTRkjV+PQfuPwLa69fS3dHN9+fOzKn+9kWCaMouX4kmjdnsqcP8jmnL1acHSkGZCVRFeDqChdH/8SreHx8/mjV/LTFSDHAKH7N55y+KsiMjevrhFE1bUpekcJwoSZgtoWKeXlO7uyTfM7pM4pT9WwqcYVyUK5rMej6xJY6NNuiCgKgYl4uuX5Uz8adcKuuNYuFRDBRDCKJzO5r56tS8jmnL7bUoauuX2XT3ryUIW+0CtJuJRj626Jw7Xz18wpIZHaPucH59tYUzWIxEWsA3j75ZdXajNjEFYNfDhGosqhpMmVTiG11cMj1abeq92b2yFr2lAXf1rKoC5m28cshccWQkZrCcy00L9XNqjeRzzkFI3w15Ppka3wFrrH4sJ7FvBAAFfOaNxaGtWwyYlOpxHhjYSiaV+fLmRcyaaP2XB715tjIlMXAVQ8jak8+57j/GgIg2jiV8UoYepq2KZs2K0HoabQfhaKNs2DGQgvyOcc1ovZcmdobC0WbWFxx/YYsGoLApI32o8DzNCsSKbxJi6ARi4YhU92+e2XUiyyluDLqRcC7jVg0DAFQhnd0oPXVER8d6HFleKfR2oYhk3vDq6VRHyO83qjFP4IA7N3pvGcUx/fudN77J3Xq//gf/xfKPGHSwrBUdwAAAABJRU5ErkJggg==" }, base),
iconCroplandUnknownUnknown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABTdJREFUeNq8V1tsFFUY/s7M7G633aVLbUtLvVToRYsaQA0UmggSJWIMUavyIMqTabWgEqIRjRp8gBcThBqCMaEvmJAGvCARjCSQFMSHpkRtBEqlpZfdbreX7e7O3mZnPP+0W9jMTncw1ZPszp6ZPd/lP//5zxmmaRr+6ybRl61l7WVNZJ55R1e1QeXghQZGTuzNa7S7q+afY/D6JF3ulzjBOtUuhMsXOl1+JTFvBKWSHf35YUWUlUoKl4fZRRc58iZj80ZSwEQ48yQpISvrBE1gq51OCbKqzmuo4lDhdkhI5QmVgmpnZXZRyDmo3JaHtvo3LJMoPDIOpwghqS0X6MuVLyGipeYc1FixAo0rX8K+hzZbc8Ij47ZJ0AS4BEpdQWA5B1W4SvVryxMtlkgSmAm/xkmYonncNhFRNWU5FBS67ZX1OV2JBTxcirZIYKpWyHjsFJiv/BXOQhzrPYegPKl/zja2Yu+zexCMR+YkSUdIuL1j1t5e/gp+3PI1Ogc68eYP7+Peovv0+219HaZjwikFTibcIqEO3TRrX1w+pl+frN2AVeXLcLjjKxw4fwB7H3vNeu2Skym4RMmUqMiejw9Pf4Z1lau5KgHP1G3U3bSebzUFJjzC1Z2oNtYbkxXYYb5WttY9h9YXPkeFp0Kfm3S46LdZIzzCVSU2LAqr7lklSuLDRQscmEwlMyabMYawquC3kW68/uAmVJVWY3TsJk79dRrtf3yPR0tq0TH+d1aSMpsD42NxyNHkSVqM7YGJWMItiJDYrQToigaxrbJBT9eNxTX4ks8DhWdgyouau5bg8Iv7sXnZpuxzwHEIj3AJX0gcuvgd4ilN5tYWCLaMP+/t+UUneoCD7n76PWx9/FWcCVzDhpr1+vOjl9tnXW8rfwTPFy/V+4QTifCocFzC1ydCE/HzgF9GkWgzqCKiMncpBicGUJjvQXP1BlzxXdEzrCS/CCfW70LDojq0eX/Ht4FefUyxzY7B0SjhfnNrnSjajtB4VMnjhcbJbWZL4ZGpETQdfxej8jiujfZgy8qXsdDpwVsdrTjY92tGVgk8qUJjssJx99A9lt7jpR0NV8pKCmrdZQ4MJKIGIiohNSXVcOe5Ub9kDT449XEGeLpV2QsQ8EXh84cv0NY760T/kVSb/CMRtVCTdDUGN1fPYO3StTrBkUttWQloHEXD7wuTi49msWer5qGL51QBPYMjEZSJDgMA7Zrd3m4EY0Fs7zyaPW35OBqvMXQTnoFk1o0vnCI12dz4+bx03ewyXeFpFyylvZOBm7EHcHau4k8zNzEljjE5YOqi1xuiFX72dhcGEj0TuApSY+bGG/QZ7nl46ot8WQRHIoqQUJsMJd+wo9HccDX9vrDBDdWuG8EhA8liXhX6vGGoNoFc9GWtwgZmrmbMG76xuDhfV5muaU/99ImxQot2pOIqQgGZFDdlxcu6P3M1/MB3htSRyrkaFULdhcROZnNhSpJ2Q+pIJanNus/c7oJXDVMs09MGV8VPMsdJJanN4eKImYs5SWYybdfUWDSRzQ31Y/EU6Dl3sXPOA8WcZydyI7FDV4emMtzQfkH9631ToOf8f5P/mmSmCnwan4gnoqEkP6lPE5XwK/WT4USCnufEyHkS5CpJbe8wnxv+OmDjJ5sSntbUt+LCEknaDVcdD3H11Y4ChKZdxK24sEyiq2XY3zsUUmx8PuhKfSsuLJPomaZq+5KRZKp/KIyknIxQ3+pYyyT63IjY6R8O0evAbqsupk/2fPu9k4/UXH/pTsew/+M9/h8BBgDTNMrgY48xwQAAAABJRU5ErkJggg==" }, base),
iconNotCroplandThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconNotCroplandThumbsUp: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAGw0lEQVR4nLWXW2wU1xnHfzPn7Mziy3oNxbuLMNiOsIFAQFxaiF1hopAIUdJIadooCm0RVVSpkg2Gl1ZJ2oQK5YE6taWmapUGJSCrKjQkRChK2yBQgELrIrfQ1NiYS21he429d5idmZ3pg70br284Lf1L+zBnznd+5zvfZc4qruvy/5YE2L1nb4eqqv4Hvbjrun1vNB+sU1zXpaGxyS0LBB40g/DgIEClbGhsqpdSJAsLC4vMdPqBATRdR9M02zTNCgn4hZBFruuSfoAQIQQej0eaplkvFUXZoGkaTiYzrUGxz0d1dTWVFYvQdZ10Os2Nm/+mq6uLRDw+pY3jOGiaRjqdrpBCiKCqqlNO1HWdurpaah/dMOnd8mVL2bb1Cc6dv8DZs+cmnYLrukgpcZzMauk4mdWappGZ4Imu67z44i5K/X4Aeq7foPNqN4ODgwQCAZbWLOGhqkpqH91AZeViDh9uywM5joP0eFAUpUiqqupXpvBk+/ZtOcCd4RGOHXsvt0hfby9/a29nYXk5zz/3LAtCIbZv38axY+99DnFdVEUBKFIdx/FLKfM8mV9WxvJlSwFImyZfmjeXHTueR9f1vI309fbS9tujueObX1aW994jJZmME1Adxy2RQjC+7h9ZuQKAS5c6ePvQuxiGwYJQaFrQpUsdeXY5jXqCOv4hq2BwtDA7u7oZCoc59M6RHKix4QeTdtzZ1Z1nB5CxbYQQn0OEEGRsm4kyDAOAoXCYltZfcLu/H6/Xy87vvJAHys6bTiqAbdsIKWecmE6nOXy4bVrQRAkpscc2rgqh9tiWlc0EAGLRGAA11UtmBcrOy9oBqIqCbVmoqnJbBS4ahoH0eHITsme8ds1qin2+mUHf3cG6dWvy7ACkx4NhGCiKclrNZJyjqVTKFELkEuBadzc912/g9Xr51jefmZRRWdBgeAivrqNrGj3Xb3CtewyiKAghSKVSZibjHFVbW5rftyzLtUwTz7i4nPjwZF5G1dXV5mIwv6yM9evXUeIrBsC0LE58eDJn65ES0zSxLMttbWl+XwKoqvKHRCKx3e/3Y1kWAIl4nEPvHOHrT21jQSjEY5s38djmTZMCfLu/nw9OnMxrlB5NIxqJoCi0wdiXMZNxGpLJxNbSuXOlKkSuIw+Fw7z11iFWrFzB0ppqqior8Hq9jEQiDAwM0nm1iyuXr+RBhZTguiQSCdt13dcAlOw3fk/Tvk5fib+msKDgvnk/kwoKCkgkk8Rj0XNvNB+sg2zFj3rz/Vg04ggp71sz00lIiaKqxKIRO5NxXsqO5yCtLc2nFUXpjsfj6Jr2X0F0TSM+Gpt/trY0n86O5215zJs/+Xw+IaScstVMlH0nfNUx0vdUIbB8vjmxdPohx3F3j5+jTLx37d6zt6PEX7qquKiIu3fvTru40X7x9L1LF9comYy3UFU1gJTjmI6qJp/df2BT7c5duYyYBGlobKpXVeWP5YsWS8MwpvQmdfL4X+xb19etLy5RA2K0U/g2VmEn73Kjo5f2ZNxe9vgTr+56t+2nMC4mWY3F5pN4LDZlbFLnz5xRem+t3VIyLwcAWP7jg6z59TECwsPjvrny2qlPXj6x/ydbp4TAaGwikQgAclymuel07G5H+8bVhUVCH9dQ5255hDmLH8aOhQHQFYVVBYXaqV+9+bt7sZgyJaS1pfmmEOrH0WgU3evNjZt9tzoLVSECwoNe4cO3sYqClUGWv/YmAHMWP8zmf10l9MIWAsLDHBSt69ynwanvQmPexONxXMfBM9ahrTvhews8ugBY+tIrrH37IxY+8w08/vl5tmX1TwIQkprWd+VyzbSQ1pbmm6qq/D4ajaJN6ML308hfz+Y9TwsBcBx3XyKRMLPeCF+JHLLN+0KMwQEAhmyTeYsW9c0IGfPml8PDw2i6jreqeuVw2iDpOFjxKABWbCTPxooOEe/4jKTjMJw2WLX1az2T6mSiGhqb/IqiDAZDIQ0gfurjM+6Vv9fVF/tzGaZX+ChcUkFhVRXD5y8Q+Uc/Z5Ix8ys7dz339P4Dx+8LAdjTtO/nmqY3BoJBUskkkSO/uemJx8rriv2iaMLtM+k4nE/FzYLy8tMv/7n9SZii4mfwZiAYCumapmGaJuGTH5yyuz/7cpGQWkiOVm2/bZr3cM36nd/79tP7DxzP2s8KAtC4e+/rXq93bzAUkgP9/bZhGD97/dVXfth17tNg35XLNQALV6y8Wl371YE5JSV5i84akvXGX1qqx6KRmOO4Fa0tzdHZ2M6YXePV2tIcVRSaIiMjAD+aLQAY/bPyRX4NjU0XvqjNrI/rf9F/AIPvVGBGHgj0AAAAAElFTkSuQmCC" }, base),
iconNotCroplandVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconNotCroplandVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconNotCroplandVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAE/UlEQVR4nL2Xz09jVRTHP/fHGwRq6QQZAYMykxEyGiNioqNBnZgYdeFfQGm3rszEuDIuJq5cunKWRmdwY0xM3PgjRlAcgwbHhSb+nGDGQAMhQwu3r+27714X/QGdUigEPau+vnvO53zPOffeVszOzvJfmwa4cmX2JyFF6riDe+//mUlPT2kA5/3DfYnkcTPI5/P3vff+1VH93vtXLyglt7u6uhLW2mMDaK3RWltr7agGUlKqhPeeKIqODSKlQCulrbUXtBDivFYK711bh+7uboaGhhgY6CfQAZGNWF/fYHV1lTAM9/TxzqO0Rlk7qqWUg0LKPRcGQcD4+Bhj959teXfP8DATDz/E73/8yW+//d5SBQ8opfDOTWjv3ITWGud8C+DZZy/Q29MDwNraOiurOfL5PH19fQwPDXLq1ABj959lYOAuFhauNYG8cyilQJDQQoqUEKIl08nJiQZga9uw+P0PjSAbGxvcuHGD/v5+nnzicU6mUkxOTrC4+EPD3wG1+iSkdz4llcK5nZ4kk0nuGR4GwFrLnYlepqaeJAiCpkQ2Nja49t1io3zJZPM2UErinL9bOu/7lBTsLta9944AsLz8N3Pz3xBFESdTqbag5eW/m/x2rFohufuhbqm+PgBWVnMUCgXmv15ogF54/rmWjFdWc01+AC6OkbWBkgBSSlwcc7vVe1AoFPj0sy+4tblJEAQ88/RUE+ig/SUBYhcjldp3YRRFLCxcawtqCawUsasmLqUUfzkbs3unFItFAIaGBjsC1dfV/erZOxsjhViRwGIlipB6R0m9xqdH76O7u3t/0DNPceb0aJMfgNSKShSBYE465z8sl8sVKSTU9ksul2NtbZ0gCDh//rGWiaqD8oUtgupByNraOrlcDSIEUkjK5XLFOf+hzGbSH8dx7OM4Ru86XpZ+vN40UePjY40eJJNJzpw5TU/3HQDYOGbpx+sNXy0lNo6J49hnM+mPdQ38eRiGL/X29mBrUxaGIfNfL/Doo49wMpXiwQfO8eAD51oafGtzk6Wl600HpdIaYwwCPoDazeicf6VcKr2YSCS0lLKx+wuFAl99Nc/IyAjDw4OcGhggCAKMMWzm86ys5Lh582YTtDqlnlKpZL33bwKI+h1/5ersr909veN3nDhRbdgRravrBGGpTFg0386kp6eAncl1zr8cGuOkUgfumXYmlUIISWiMdc6/0fi+/iGbSc8h+KMYhgT6aJBAK4rV3vySzaTnWiDQUBMLIQ+tpkmF9xeb3u1+qNF/PoqaQCuKxoDgy90qWiAAzvuLoTH2MGpUbV0xDK1z/uXb37dAar35slgsdqymOtZFRFXF8oEQqPbGGNOUZTur/9IJw5C9VLSFZDPpZSnFZ8YUW86tFkhNhZTik71UtIVAbdLCEO8duo2a21S80i5WW0g2k16WQnxkTBHdRk1DhRDvtlOxLwTAef9aqVSq7KVGK4WLY0qlUsV5/+p+cfaFZDPpZSG4vL213axGCHQQsLW9jRBczmbSm0eGADjnL5UrlYq1Fq01AIHWWGuJoqjinL90UIwDIdlMelMILhtj0FojhEApVb0vOlDREQSqaqIoKltr6erqqqsod6KiY0gt27eNMVYIgTHGAm93oqJjCID3/q0oimJTLGKjyHjv3+rUt2NINpPeFPCq2d4GeL1TFYeCAMzMTL8jhFicmZl+5zB+4v/4H/8v9ZiRYGkwyhkAAAAASUVORK5CYII=" }, base),
iconNotCropland: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABNVJREFUeNq8V1toHGUUPnPZ3Vy26W5sLhWr2Wg2UdoQ0zwUG7D6IJQQffBKaVARiiCkaeyT9KH45IP2BuJLMWhrFFoFLVUUhD40mkItFfMQN9bGtrTd1Ow1G3cnO7ue78/OdPY+W6IHZmf/nfOf73znP5cdKZvN0n8tEkDG9r19WZZlz1obZ9s3Dh96f1CAjO4dz7a2ta05g4VgEDefEgrHdqiq8sKGlhYnQ5Miy2ty1dfX03IikdZ1/YzKSB5FUd1glEql1oyFoijkcDhUTdN2qJIkbXM6nZTR9bIb1jU1kd/vJ1/Hg+RyuYQzV+evUSAQoHgsVnJPJpMh2GXdDpUR2/nQSyrC4ODgdtr+xLaiZ4892kNDO5+hqZ+m6fz5qaIoIDKqqjKY3qfiA4h6ARMA7NnzBnk9q0l35c+rNPv7HAX5MNs4SXq6u+jhTp9wwOd7iE6cmMwDAhPV4SCOlFtF6kolmAwPD5kAfy+G6PTpr0wjN65fp18uXqQHNm2iXa+8SPdv3Cj0oWOCMBNZkvDVLTOiB7SsTFpaW0U4IClNow33NdPIyC7BzioAm/zilBk+7LOKQ9jNtDFIdj0fDFnrvnfLZnG/dOkyfTzxKSWTSeFtOSDoWffdLXXBhGTrwpD29tXCnA3M0Z2FBZr45KQJtHf0rSKPoWfdB9HTaZHGJggW+LFQYBgCoKPHPqSbt25RXV0dvf7q7jwgQ6+cCJA0UFW1oiIOHRlUDqioGNleOue4rCjylfTKipEJQqKRqLh3+7tsARl6xj5hmO0Ju7J0E0wugC5yujDGW/v7RLVXBHpthAYG+vP2QWAPdrlOzsmcYqcSiYQmDinH5o+5OVF8MPLyS88XZZQBFFy4Q3X8zMXFDH3sMxIJ9mAX9pUL0z/Pnv32uwONDQ0qKKJSIfN/XaPH+3rJ6/XSwNZ+QsH+k0yhs4oQ9fZuoa5HOkXr0DgsJz/7nLRcsXJjFHai0Wj62NFDu8Vpc9x+iMfjwx6u8BXeAEHjQ+o+9+yQSN2nn3pSXIWCsH39zdm8RulgZpFwGIQmRehETuuZ0aWl+E5vc7PKmWB2ZKTu8eMTtJmLrKfbT52+DhHCEBu4fTvIvSxAM7/NFGUV5hI7neYm+a45fiH7xvfPNq33dHPYquZ9JWng/fGlJYpFI1MYvXcrfpXNm9FIOANPqtVMpdrA2bEdnoiZA3l/JAwx2Kxzu2l5efmeWTDIr0cOf9CXV/EFbHR4UysbKwtuumNFbcUQTrdzfJuJcaYg92sR6EcjERTfjzk7pUFWJ1p2DN7UwkbN6aEuEI2SDbKQDbyJRaO22bg4rSPMgusNLOarghhnE+ZasHpZTlDdWa5uhLgUi7Ig8Ia78/fwDl5WEif3Luix/plSLMqCGGzgHbx0WDp0BRajFYdWOTYc4y/hpbOgCxeyYL2JciwqguQybT/3IK0UG6wxsvGc9carjt8qbD5aXFzMZ8PtFWv8juesF7lnkNzZHOQWw/+bNdHCjcLDmhsphtLBajaqgsBLeIv5gAnJNWTOCzssbIEYbNjrFMZuQ2OjGL9Y22FhGyTn7RH2Po03ANyxtsPCNkjuVeA99l5HyqZSyQTWdvfaBoHXfBzj4VAIy3fssjBfVmq5+CV2utY90v/xHv+vAAMAxEX68QbHKZoAAAAASUVORK5CYII=" }, base),
iconRedSelectedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAEVUlEQVR4nL2XS2gdVRiAv3PmzH0kNzfXorRIwYDgQhfNRlpKF10UUVx001JwFi6EEjelFEEQF+qquOqqGWYjXaQFW6EilioN3o2FSpUWbNKmjWQRrhCwmdzcxzzOzHFxmzTpfWQSov9uzuP/zjfn/PMQU1NT/NehAL79eOKeQlR2O3mCWTw56R5RALFJD7y9Z3S3Gdx+uvLa1MTpMTU1cfpoUViNvaP5kqnHuwYQZZtK3da+jscUUCkoWSI1sIsQk5eUbKV8HR+VCnmobCtMnO4sW9lG7B/qbteGom0xItWYLEq5Lyfljldc+OA4Q2c+xTo0trkjMVSURWDScRmYdLySUxBu38Q+fhDrrcMAmKcrXZBcTiKhJBWiYu/AQOwfInfsFADhjSukc8ubB2jTgUNJxphKLmfBNvekcOIEAOn8PXT1Yc8xr0hJZNK9Upt0tCIFbINhje9Dvj4OQHDtWt9xQggA5MaLrJE7+g4A+u4tzGKr96AwgZx8DiEnO40bo2wz/PWX2McP9rZorxJNVzMtSgJEUQJ5a1OHffhNKI6QO3YK+90D3Ra//9LfAiBvdfICMi/kvB8noDbfsvjmfaIfL3USv/8h8o2XNu1F9Otvg5evBH6cYAtZk8CdpUBDobsg45v3SR7cBqDgfIR96EjHYtBerEVBshRoJFRlaNKrtVYYibwFsvsABJe/h/YqYs+r64W35V5Igchb1FphFJr0qnRc73pba7McJ1C0uifUY8IbV9YvM1kULZbDhLbWxnG96xJACfHzk3obhnpAAF19iL57q1N49/8YDADEsOJJo40lxGV49maMTHrm72b4nt4zrJQte1Z/eOnGlskByFvEEmqNQKeYr+DZEXZcb0HB/Fw9hJLKlqxflBVzqyFKiDuO6y2sQwBCk078tdJMdUF21UzmyFtoJZhfaerIpJ+vNa9DHNerWvB4rh5CeYc2ZcVcPUTCA8f1ql0QWLdJtBLbt9lgEZv07MauTRDH9aoC/tyRTVnxaLmNjZjeaNEFAYhNenZ+pam3ZVO0aEmYX23pwCQTL3Z3QRzXq9qI6Ud+kNlGjNrM+C1yQk6vnaiBEIDAJBOP6w1akt5PgY0xrGgaw2KjTS+LvhDH9RYKwvppxm8hRgd/AYgRtWbxQy+LvhDo2Cw22jSNgeE+t22DRWTSM/1y9YU4rreghPxuxm8hRnpD1ixsIb/pZzEQAqBN+kmtEUQ9bYYVzSSl1gii2KTnBuUZCHFcb8EWYnLmnxdspECMKO4+bWILMem4nr9jCEBo0i9q7SBaipPnD8+SYilO8IMoCk36xVY5toQ4rufbQkzO+i1E2QYlECXFrN/KZJEJAh0bP4jCpVAjXs6zFGr8IAqzWGSGOK7nS8SF2eWWRklml1taIi5kscgMAdCk5/0wSh4st6lHcVOTns86NzPEcT1fCXFuzl9FwmdZLbYFATg56V6UiDsnJ92L25kn/o//+H8BBP8P19hllwIAAAAASUVORK5CYII=" }, base),
iconRedSelected: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABDBJREFUeNq8V0tsG0UY/md2vGunTpyXkwYVEYQ4IHGAC0KCQxGn9g6IihuXgqCgUkUCKh5FAoRKBVwKEhUnKiFAKlSigBQIQgkkXDikUitUpYJiJ85ra68fu96d4f/HTWrHa3ttAivZs5OZ+b/v+18TM6UU/NcPI5CXx9O/m4wP7rZxX6lrb6zkHtQgL6RH1KFbx3ddwdm/Vmi4XSDA/gEunDvG+pJq1d09F6UtmMhZftZ1JwXOB/stkYRAgcpVdk9GnwHDlikQZD/HWNw/ZpmgKkFvjMfiwO9ONS94ElKJGKSFOclThtgbN3jPhJPvvAipz74F87F7d0Yd9sYEFKR/D6eviYQJUOpeSeKlRyD28CH9Lq+tNC5WJfQlBAhgSXLXYJyxrgHIRYmn3tTvpVNT4M9mGtYVukuDo1juKjmYQEToMibJ10/UvLLwDbhnfg7dM2kYUJLBOHelTE1wDiqIXvmxg3eCuO+gfndefaV1Uhg1D/H6SeRYPPlMLYHOnQa5eD18U9EHiBs3QfSE/rgjNYcu/qKDG6ZC5deg9NGZaPGjr3IFAfaIhgXr8YeADYzq4MafO9Cs4uuPW6ugB+1puwSS5MaVbNkHZjbWSuX9C1A6eaRWvMc+APHALQ2xKH/6RfsiRXtkN8F5hizPLxWxZyVF00YCqk6frWXTyQ8h/ugTnWOxnX4CyK4BbIY7Mvj8kl30GLkrJAGcqbe0//m+u7YLr2Ms0A7ZI7tkn7+7un4u73kqg/5jA7Gm/dQ0qdi2W1IEFWQnU6oC2SX7OhBY9d/Pr+YBUrHQQ1RsZFwX3oXznZvmsAnz6wWIMaZ9rQOBVXnksu0ccPcNCZPSOaT6nWdPRSsidFMFqV/aKPh4M57YTmGUdNVU7MpcztEs/u1lNbdWJO/Mk92bxUgFKoPDv+U2pdsvmmom8oPnXIvDQm7TR+8cbyjGG2pmYor9odUgm55V4HlDwUWy1wRSpyYgNl2rqVNRkfL5prZSr4YrWOxFDe2fzeQhrvh0vYomEF3lyILYdKOG6sLGrQtrto837eHQBrlTDbGZXS5EVsPG4zCTvQ4JZkxvZVRbEHqIzdzKhmYX1gUaAIZM2FQSFtfzEKaiJQix6efiO2JHLNuCjFpaRR83zoepaAmypYbYEUti20kFdY22l1YrNRbnX2o1o1ZbFXhnfNJKRVsQ3RilPIY9yAtTo1VUA+pRXlnKox2v37ZqGD/94592oxq6L3D+1d8bQOu4z+4Z5EYXeO1ywfGWKlVgIzUgGmmedcoerUf6R6KDGpvY/rRs1+oG727q1DSPoiISyJYaZO0uFT3gt+0BGmkeRUVkEGKL/N+bydo+KaGR5lFURAbRd7uSby8Xy8EP2ARXS5UizSN3T/rNGPVzfCz99NHRYUVjN+e6AqHPVHrk127PsP/jd/w/AgwAtoGzEPyHsdUAAAAASUVORK5CYII=" }, base),
};
}]);;
app.factory('locationFactory', ['mappings', '$http', '$rootScope', '$filter', '$q', '$timeout', 'icons', 'log', 'User', function (mappings, $http, $rootScope, $filter, $q, $timeout, icons, log, User) {
    var _baseUrl = 'https://api.croplands.org',
        _cf = crossfilter(), allRecords = [],
        l = {
            cf: {},
            markers: [],
            filters: {}
        };

    function updateSingleRecord(data) {
        var deferred = $q.defer();

        data = angular.copy(data);

        //Clear existing filters
        _.each(l.filters.list, function (filter) {
            l.cf.dims[filter.dim].filterAll();
        });

        // Filter by id
        l.cf.dims.id.filter(data.id);

        // Update old result if it exists
        if (l.cf.dims.id.top(Infinity).length) {
            var existingRecord = l.cf.dims.id.top(1)[0];

            // update data
            _.merge(existingRecord, data);

            // update the icon
            l.setIcon(existingRecord);
            deferred.resolve(existingRecord);
        }
        else {
            l.setIcon(data);
            _cf.add([data]);

            deferred.resolve(data);
        }
        log.info('Updated record #' + data.id, true);

        // Replace existing filters
        l.cf.dims.id.filterAll();

        l.returnMarkers();
        return deferred.promise;
    }

// Crossfilter Dimensions
    l.cf.dims = {
        id: _cf.dimension(function (d) {
            return d.id;
        }),
        year: _cf.dimension(function (d) {
            return d.year;
        }),
        landUseType: _cf.dimension(function (d) {
            return $filter('mappings')(d.land_use_type, "landUseType");
        }),
        crop: _cf.dimension(function (d) {
            return $filter('mappings')(d.crop_primary, "crop");
        }),
        water: _cf.dimension(function (d) {
            return $filter('mappings')(d.water, "water");
        }),
        intensity: _cf.dimension(function (d) {
            return $filter('mappings')(d.intensity, "intensity");
        }),
        spatial: _cf.dimension(function (d) {
            return {lat: d.lat, lon: d.lon};
        }),
        validation: _cf.dimension(function (d) {
            return d.use_validation;
        })
    };

//Crossfilter Groups
    l.cf.groups = {
        id: l.cf.dims.id.group(),
        year: l.cf.dims.year.group(),
        landUseType: l.cf.dims.landUseType.group(),
        crop: l.cf.dims.crop.group(),
        water: l.cf.dims.water.group(),
        intensity: l.cf.dims.intensity.group(),
        validation: l.cf.dims.validation.group()
    };

// Filters
    l.filters.byPolygon = function (bounds, filterAll, echo) {
        // Filter markers from previous polygon or clear previous polygon and then filter
        if (filterAll === true || filterAll === undefined) {
            l.cf.dims.spatial.filterAll();
        }
        // Custom filter function
        l.cf.dims.spatial.filterFunction(function (d) {
            return  ((bounds.southWest.lng <= d.lon) &&
                (bounds.northEast.lng >= d.lon) &&
                (bounds.southWest.lat <= d.lat) &&
                (bounds.northEast.lat >= d.lat));
        });
        if (echo) {
            l.returnMarkers();
        }
    };
//    l.filters.year = function (start, end, echo, save) {
//        save = save === undefined ? true : save;
//        if (save) {
//            var args = [].slice.call(arguments);
//            args[3] = false;
//            l.filters.list.push({name: start, dim: 'year', func: l.filters.year, arguments: args});
//        }
//
//        end = end || start;
//        l.cf.dims.year.filterRange([start, end + 1]);
//        if (echo) {
//            l.returnMarkers();
//        }
//
//    };

    l.filters.years = function (years, echo) {
        l.cf.dims.year.filterFunction(function (d) {
            return years[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.landUseType = function (type, echo) {
        // Takes an array of cropland using the land use integer number
        l.cf.dims.landUseType.filterFunction(function (d) {
            return type[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };
    l.filters.crops = function (crops, echo) {
        // Takes an array of crops using the crops integer number
        l.cf.dims.crop.filterFunction(function (d) {
            return crops[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.intensity = function (intensity, echo) {
        // Takes an array of intensities using the intensity integer number
        l.cf.dims.intensity.filterFunction(function (d) {
            return intensity[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.water = function (water, echo) {
        // Takes an array of water use types using the integer number
        l.cf.dims.water.filterFunction(function (d) {
            return water[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.reset = function () {
        _.each(l.cf.dims, function (dim) {
            dim.filterAll();
        });
        if (User.getRole() !== 'validation' && User.getRole() !== 'admin') {
            l.hideValidation();
        }
    };

    l.hideValidation = function (echo) {
        l.cf.dims.validation.filterAll();
        l.cf.dims.validation.filter(0);
        log.debug('[LocationFactory] Hiding Validation Data');
        if (echo) {
            l.returnMarkers();
        }
    };

    l.showValidation = function (echo) {
        l.cf.dims.validation.filterAll();
        if (echo) {
            l.returnMarkers();
        }
    };

    l.clearAll = function () {
        l.filters.reset();
        _cf.remove();
    };

    l.clear = function (dim) {
        l.cf.dims[dim].filterAll();
        _.remove(l.filters.list, function (filter) {
            return filter.dim === dim;
        });
        l.returnMarkers();
    };

// Return filtered markers
    l.returnMarkers = function () {
        l.markers = l.cf.dims.year.top(10000);
        log.info('Markers Filtered');
        $rootScope.$broadcast("locationFactory.markers.filtered");

    };
// Download All Markers
    l.getMarkers = function () {

        // Remove all existing location
        l.clearAll();
        var file1 = $q.defer(),
            file2 = $q.defer(),
            file3 = $q.defer();


        $http({method: 'GET', url: '/s3/json/records.p1.json'}).
            success(function (data) {
                l.addMarkers(data).then(function () {
                    file1.resolve();
                });
            });
        $http({method: 'GET', url: '/s3/json/records.p2.json'}).
            success(function (data) {
                l.addMarkers(data).then(function () {
                    file2.resolve();
                });
            });
        $http({method: 'GET', url: '/s3/json/records.p3.json'}).
            success(function (data) {
                l.addMarkers(data).then(function () {
                    file3.resolve();
                });
            });
        $q.all([file1.promise, file2.promise, file3.promise]).then(function () {
            $rootScope.$broadcast("locationFactory.markers.downloaded");
            l.returnMarkers();
        }, function () {
            log.warn("Could not download locations.", true);
            l.returnMarkers();
        });
    };

    l.setIcon = function (record) {
        var iconString = '';

        if (record.land_use_type === 1) {
            iconString += "iconCropland";
            iconString += $filter('mappings')(record.intensity, "intensity");
            iconString += $filter('mappings')(record.water, "water");
        } else {
            iconString += 'iconNotCropland';
        }

        if (record.visited) {
            iconString += 'Visited';
        }

        if (record.user_rating) {
            if (record.user_rating.rating > 0) {
                iconString += 'ThumbsUp';
            }
            if (record.user_rating.rating < 0) {
                iconString += 'ThumbsDown';
            }
        }

//        log.debug('[LocationFactory] Setting icon: ' + iconString);

        if (icons[iconString] === undefined) {
            log.error('No icon exists for class');
        } else {
            record.icon = icons[iconString];
        }

    };


    l.addMarkers = function (data) {
        var deferred = $q.defer(),

            keys = data.meta.columns,
            records = [];

        (function () {
            for (var n = 0; n < data.objects.length; n++) {
                var record = {};

                for (var i = 0; i < keys.length; i++) {
                    record[keys[i]] = data.objects[n][i];
                }

                l.setIcon(record);
                records.push(record);
            }
            allRecords = allRecords.concat(records);
            _cf.add(records);
            deferred.resolve();
        })();


        return deferred.promise;
    };


// Events to listen for
    $rootScope.$on('User.change', function () {
        if (User.getRole() !== 'validation' && User.getRole() !== 'admin') {
            l.hideValidation(true);
        }
    });


// Download Single Marker with Details
    l.getLocation = function (id, callback, attemptsRemaining) {

        $http({method: 'GET', url: _baseUrl + '/api/locations/' + String(id)}).
            success(function (data, status, headers, config) {
                _.map(data.history, function (d) {
                    d.data = JSON.parse(d.data);
                });

                // sort records by most recent first
                data.records = _.sortBy(data.records, function (record) {
                    var index = -(record.year * 100 + record.month);
                    return index;
                });

                log.debug('[LocationFactory] Merge records begin.');

                var hash = {};
                _.each(data.records, function (record, idx) {
                    hash[record.id] = idx;
                });

                _.each(allRecords, function (record) {
                    if (hash[record.id] !== undefined) {
                        record = _.merge(record, data.records[hash[record.id]]);
                        record.visited = true;
                        l.setIcon(record);
                        data.records[hash[record.id]] = record;
                    }
                });
                log.debug('[LocationFactory] Merge records complete.');

                callback(data);
            }).
            error(function (data, status, headers, config) {
                if (status === 500) {
                    log.warn('Error retrieving location');
                    $timeout(function () {
                        if (attemptsRemaining === undefined) {
                            attemptsRemaining = 3;
                        }
                        if (attemptsRemaining > 0) {
                            l.getLocation(id, callback, attemptsRemaining);
                        }
                    }, 1000);
                }
                // called asynchronously if an error occurs
                // or server returns response with an error status.
            });
    };

    l.changeMarkerIcon = function (id) {
        l.cf.dims.id.filter(id);
        l.setIcon(l.cf.dims.id.top(1)[0]);
        l.cf.dims.id.filterAll();

    };

    l.getTotalRecordCount = function () {
        return _cf.size();
    };

    l.getFilteredRecordCount = function () {
        return l.cf.dims.year.top(Infinity).length;
    };
    l.postLocation = function (location, callback) {
        // Send to Server
        location.source = 'web app';
        location.accuracy = 0;
        return $http({method: 'POST', url: 'https://api.croplands.org/api/locations', data: location})
    };
    l.saveRecord = function (record, callback) {
        var deferred = $q.defer(),
            data = {}, method, id, url = _baseUrl + '/api/records', allowedFields = ['id', 'land_use_type', 'water', 'crop_primary', 'crop_secondary', 'location_id', 'year', 'month'];

        data = angular.copy(record);
//        // Remove keys users cannot change

        _.each(Object.keys(data), function (key) {
            if (!_.contains(allowedFields, key)) {
                delete data[key];
            }
        });

        // Post or Patch
        if (data.id) {
            method = 'PATCH';
            url += "/" + data.id.toString();
        } else {
            method = 'POST';
            data.source_type = 'derived';
            data.source_description = 'croplands web application';
        }

        // Send to Server
        $http({method: method, url: url, data: data}).
            success(function (data) {
                // add location info for new records
                data.lat = record.lat;
                data.lon = record.lon;
                // update crossfilter
                log.info('[LocationFactory] updated record #' + data.id);
                updateSingleRecord(data).then(function (data) {
                    deferred.resolve(data);
                });

            }).
            error(function (data, status) {
                deferred.reject();
                log.error('[LocationFactory] Failure to update record');
                console.log(data);
            });

        return deferred.promise;
    };

    /*
     Returns a csv string of the currently filtered locations.
     #TODO add more columns for greater value(source, quality)
     */
    l.getCSV = function () {

        var records = l.cf.dims.year.top(Infinity);
        var csv = [
            ["location_id, record_id, lat, lon, year, land_use_type, water, intensity, crop_primary, rating, use_validation"]
        ];
        _.each(records, function (record) {
            var recordString = [record.location_id,
                record.id,
                record.lat,
                record.lon,
                record.year,
                mappings.landUseType.choices[record.land_use_type].label,
                mappings.water.choices[record.water].label,
                mappings.intensity.choices[record.intensity].label,
                mappings.crop.choices[record.crop_primary].label,
                record.rating,
                record.use_validation
            ].join(",");
            csv.push(recordString);
        });
        return csv.join('\r\n');

    };

    l.getRecords = function () {
        return allRecords;
    };
    return l;
}]);;
app.service('log', ['$log', '$timeout', function ($log, $timeout) {
    var _log = [];
    var _prefix = '[GFSAD] ';

    var save = function (message) {
        _log.push({date: Date.now(), message: message});
    };

    this.info = function (message, log) {
        $log.info(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.warn = function (message, log) {
        $log.warn(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.error = function (message, log) {
        $log.error(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.debug = function (message) {
        $log.debug(_prefix + message);
    };
    this.getLog = function () {
        return _log;
    };
}]);
;
app.factory('mapService', ['wmsLayers', 'leafletData', '$http', '$q', '$interval', '$timeout', function (wmsLayers, leafletData, $http, $q, $interval, $timeout) {
    var CroplandMap = function (name, type, assetName, years, layerOptions, legend) {
        this._getUrl = function (year) {
            return 'https://tiles.croplands.org/' + this.assetName + '/{x}/{y}/{z}?year=' + year;
        };

        this.play = function () {
            var self = this;
            if (this.loop) {
                $interval.cancel(this.loop);
                delete this.loop;
            } else {
                this.visible = true;
                this.loop = $interval(function () {
                    self.next();
                }, this.playSpeed);
            }
        };

        this.name = name;
        this.assetName = assetName;
        this.type = type;
        this.zIndex = 10;
        this.url = this._getUrl(2014);
        this.years = years;
        this.activeYear = 2014;
        this.layerOptions = layerOptions;
        this.refresh = true;
        this.playSpeed = 5000;
        this.legend = legend;
        this.setYear = function (year) {
            this.activeYear = year;
            this.url = this._getUrl(year);
        };
        this.next = function () {
            if (this.years) {
                var idx = _.indexOf(this.years, this.activeYear);
                if (idx === this.years.length - 1) {
                    this.activeYear = this.years[0];
                } else {
                    this.activeYear = this.years[idx + 1];
                }
                this.url = this._getUrl(this.activeYear);
            }
        };
        this.previous = function () {
            if (this.years) {
                var idx = _.indexOf(this.years, this.activeYear);
                if (idx === 0) {
                    this.activeYear = this.years[this.years.length - 1];
                } else {
                    this.activeYear = this.years[idx - 1];
                }
                this.url = this._getUrl(this.activeYear);
            }
        };
        this.reset = function () {
            if (this.years) {
                this.url = this._getUrl(this.years[this.years.length - 1]);
            }
        };
        this.stop = function () {
            $interval.cancel(this.loop);
            delete this.loop;
        };

    };


    var map = {
        allowedEvents: {
            map: {
                enable: ['moveend', 'click'],
                logic: 'emit'
            },
            marker: {
                enable: ['click'],
                logic: 'emit'
            }
        },
        bounds: {
            northEast: {
                lat: 90,
                lng: 180
            },
            southWest: {
                lat: -90,
                lng: -180
            }
        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        layers: {
            baselayers: {
                googleHybrid: {
                    name: 'Satellite',
                    layerType: 'HYBRID',
                    type: 'google',
                    visible: true
                },
                googleTerrain: {
                    name: 'Terrain',
                    layerType: 'TERRAIN',
                    type: 'google',
                    visible: false
                },

                googleRoadmap: {
                    name: 'Streets',
                    layerType: 'ROADMAP',
                    type: 'google',
                    visible: false
                }

            },
            overlays: {
                gfsad1000v00: wmsLayers.gfsad1000v00,
                gfsad1000v10: wmsLayers.gfsad1000v10,
                locations: {
                    name: 'Locations',
                    type: 'markercluster',
                    visible: false,
                    layerOptions: {
                        showCoverageOnHover: false,
                        chunkedLoading: true,
                        disableClusteringAtZoom: 10,
                        removeOutsideVisibleBounds: true
                    }
                },
                australia: new CroplandMap('Australia 250m Cropland Products 2000 to Present from ACCA', 'xyz', 'australia_acca', [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
                    {},
                    [
                        {label: '1 Croplands, rainfed, SC (Season 1 & 2), all crops', color: '#FFFF00'},
                        {label: '2 Croplands, rainfed,SC, pastures', color: '#66FFFF'},
                        {label: '3 Croplands, irrigated, SC, DC (Season 1 & 2), all crops', color: '#FF66FF'},
                        {label: '4 Croplands, irrigated, SC, pastures', color: '#00B0F0'},
                        {label: '5 Croplands, irrigated, continuous, orchards ', color: '#00B050'},
                        {label: '6 Croplands,  fallow ', color: '#FBD4B4'}
                    ]),
                africa: new CroplandMap('Africa 250m Cropland Products 2003 to Present from ACCA', 'xyz', 'africa_acca',
                    [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
                    {},
                    [
                        {label: '1 Irrigated, Single, Mixed Crops I / Rice', color: '#0E1771'},
                        {label: '2 Irrigated, Single, Mixed Crops II / Rice / Sorghum', color: '#1E5CFF'},
                        {label: '3 Irrigated, Double, Mixed Crops I / Rice', color: '#00B30C'},
                        {label: '4 Irrigated, Double, Mixed Crops II / Rice', color: '#8B7140'},
                        {label: '5 Irrigated, Continuous, Sugarcane / Plantation / Other', color: '#DFFFB7'},
                        {label: '6 Irrigated, Continuous, Mixed Crops', color: '#FEA800'},
                        {label: '8 Rainfed, Single, Rice', color: '#F8FF00'},
                        {label: '9 Rainfed, Single, Maize / Unknown', color: '#00FFE3'},
                        {label: '10 Rainfed, Double, Maize / Rice', color: '#73FF71'},
                        {label: '11 Rainfed, Continuous, Plantation / Unknown', color: '#FD0000'},
                        {label: '12 Rainfed, Continuous, Sugarcane / Plantation / Other', color: '#FF50DC'},
                        {label: '14 Rainfed, Unclassified Croplands', color: '#953663'},
                        {label: '7, 13 Fallow Croplands', color: '#FFBABB'},
                        {label: '15, 16 Not Croplands', color: '#000000'}
                    ]
                )
            }
        },
        paths: {
            selection: {
                opacity: 0.75,
                weight: 2,
                type: "rectangle",
                created: false,
                cropped: false,
                visible: false,
                dashArray: '3, 3',
                color: '#428bca',
                fillColor: 'rgba(150,200,255,0.9)',
                latlngs: [
                    {lat: 0, lng: 0},
                    {lat: 0, lng: 0}
                ]
            }
        },
        markers: []

    };

    map.zoom = function (lat, lon, zoom) {
        if (zoom) {
            map.center.zoom = zoom;
        }
        map.center.lat = lat;
        map.center.lng = lon;
    };
    map.zoomIn = function () {
        this.center.zoom += 1;
    };
    map.zoomOut = function () {
        this.center.zoom -= 1;
    };
    return map;
}]);;

app.constant('mappings', {
    landUseType: {'label': 'Land Use Type',
        'style': 'primary',
        'choices': [
            {'id': 0, 'order': 8, 'label': 'Unknown', 'description': 'Not cropland is...'},
            {'id': 1, 'order': 1, 'label': 'Cropland', 'description': 'Cropland is...'},
            {'id': 2, 'order': 4, 'label': 'Forest', 'description': 'Forest is ...'},
            {'id': 3, 'order': 3, 'label': 'Grassland', 'description': 'Grassland is ...'},
            {'id': 4, 'order': 2, 'label': 'Barren', 'description': 'Barrenland is ...'},
            {'id': 5, 'order': 6, 'label': 'Builtup', 'description': 'Urban is ...'},
            {'id': 6, 'order': 5, 'label': 'Shrub', 'description': 'Shrub is ...'},
            {'id': 7, 'order': 7, 'label': 'Water', 'description': 'Water is ...'}
        ]},

    water: {'label': 'Water Source',
        'style': 'danger',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'No irrigation specified...'},
            {'id': 1, 'label': 'Rainfed',
                'description': 'Rainfed is ...'},
            {'id': 2, 'label': 'Irrigated',
                'description': 'Irrigated is ...'}
        ]
    },
    intensity: {'label': 'Intensify of Cropping',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Single', 'description': 'Single is...'},
            {'id': 2, 'label': 'Double', 'description': 'Double is...'},
            {'id': 3, 'label': 'Triple', 'description': 'Triple is...'},
            {'id': 4, 'label': 'Continuous', 'description': 'Continuous is...'}
        ]
    },    source: {'label': 'Source of data',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Site Visit', 'description': 'Single is...'},
            {'id': 2, 'label': 'Satellite', 'description': 'Double is...'},
            {'id': 3, 'label': 'Third Party', 'description': 'Triple is...'},
            {'id': 4, 'label': 'Other', 'description': 'Continuous is...'}
        ]
    },
    confidence: {'label': 'Confidence',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Low', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Moderate', 'description': 'Single is...'},
            {'id': 2, 'label': 'High', 'description': 'Double is...'}
        ]
    },
    crop: {'label': 'Crop Type',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'No crop type specified.'},
            {'id': 1, 'label': 'Wheat', 'description': ''},
            {'id': 2, 'label': 'Maize (Corn)', 'description': ''},
            {'id': 3, 'label': 'Rice', 'description': ''},
            {'id': 4, 'label': 'Barley', 'description': ''},
            {'id': 5, 'label': 'Soybeans', 'description': ''},
            {'id': 6, 'label': 'Pulses', 'description': ''},
            {'id': 7, 'label': 'Cotton', 'description': ''},
            {'id': 8, 'label': 'Potatoes', 'description': ''},
            {'id': 9, 'label': 'Alfalfa', 'description': ''},
            {'id': 10, 'label': 'Sorghum', 'description': ''},
            {'id': 11, 'label': 'Millet', 'description': ''},
            {'id': 12, 'label': 'Sunflower', 'description': ''},
            {'id': 13, 'label': 'Rye', 'description': ''},
            {'id': 14, 'label': 'Rapeseed or Canola', 'description': ''},
            {'id': 15, 'label': 'Sugarcane', 'description': ''},
            {'id': 16, 'label': 'Groundnuts or Peanuts', 'description': ''},
            {'id': 17, 'label': 'Cassava', 'description': ''},
            {'id': 18, 'label': 'Sugarbeets', 'description': ''},
            {'id': 19, 'label': 'Palm', 'description': ''},
            {'id': 20, 'label': 'Others', 'description': ''},
            {'id': 21, 'label': 'Plantations', 'description': 'Plantations or other continuous crops'},
            {'id': 22, 'label': 'Fallow', 'description': ''}
        ]
    },
    lat: {
        'label': 'Latitude'
    },
    long: {
        'label': 'Longitude'
    }

});;
app.value('wmsLayers', {
    gfsad1000v00: {
        name: 'GCE 1km Crop Dominance',
        type: 'wms',
        url: 'https://mapsengine.google.com:443/10477185495164119823-00161330875310406093-4/wms/',
        layerOptions: {
            layers: '10477185495164119823-00161330875310406093-4,10477185495164119823-10559428504955428209-4',
            format: 'image/png',
            minZoom: 0,
            opacity: 0.7
        },
        attribution: '<a href="https://powellcenter.usgs.gov/globalcroplandwater/sites/default/files/August%20HLA-final-1q-high-res.pdf">Thenkabail et al., 2012</a>',
        legend: [
            {label: 'Irrigated: Wheat and Rice Dominant', color: '#0000FF'},
            {label: 'Irrigated: Mixed Crops 1: Wheat, Rice, Barley, Soybeans', color: '#A020EF'},
            {label: 'Irrigated: Mixed Crops 2: Corn, Wheat, Rice, Cotton, Orchards', color: '#FF00FF'},
            {label: 'Rainfed: Wheat, Rice, Soybeans, Sugarcane, Corn, Cassava', color: '#00FFFF'},
            {label: 'Rainfed: Wheat and Barley Dominant', color: '#FFFF00'},
            {label: 'Rainfed: Corn and Soybeans Dominant', color: '#007A0B'},
            {label: 'Rainfed: Mixed Crops 1: Wheat, Corn, Rice, Barley, Soybeans', color: '#00FF00'},
            {label: 'Minor Fractions of Mixed Crops: Wheat, Maize, Rice, Barley, Soybeans', color: '#505012'},
            {label: 'Other Classes', color: '#B2B2B2'}
        ]
    },
    gfsad1000v10: {
        name: 'GCE 1km Multi-study Crop Mask',
        type: 'wms',
        url: 'https://mapsengine.google.com:443/10477185495164119823-00161330875310406093-4/wms/',
        layerOptions: {
            layers: '10477185495164119823-00161330875310406093-4,10477185495164119823-16382460135717964770-4',
            format: 'image/png',
            minZoom: 0,
            opacity: 0.7,
        },
        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
        legend: [
            {label: 'Croplands, Irrigation major', color: '#FF00FF'},
            {label: 'Croplands, Irrigation minor', color: '#00FF00'},
            {label: 'Croplands, Rainfed', color: '#FFFF00'},
            {label: 'Croplands, Rainfed minor fragments', color: '#00FFFF'},
            {label: 'Croplands, Rainfed very minor fragments', color: '#D2B58C'}

        ]
    }
});;
app.filter('mappings', ['mappings', function (mappings) {
    return function (key, field) {
        key = key || 0;
        return mappings[field].choices[key].label;
    };
}]);;
app.filter('monthName', [function () {
    return function (monthNumber) { //1 = January
        var monthNames = [ 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December' ];
        return monthNames[monthNumber - 1];
    };
}]);;
app.filter('prepend', [function () {
    return function (key, field) {
        return field + key;
    };
}]);;
app.filter('unsafe', ['$sce', function($sce) {
    return function(val) {
        return $sce.trustAsHtml(val);
    };
}]);;
app.controller("AccountFormController", ['$location', '$scope', 'log', '$window', function ($location, $scope, log, $window) {
    var path = $location.path().split('/');
    if (path[1] === 'account' && path[1]) {
        $scope.$emit('user.' + path[2], true);
    } else {
        $window.location.href = '/';
    }

}]);;
app.controller("ClassifyController", ['$scope', 'mapService', 'mappings', '$http', function ($scope, mapService, mappings, $http) {
    var page = 1, max_pages = 1;

    // Apply defaults
    angular.extend($scope, {
        counter: 0,
        center: {lat: 0, lng: 0, zoom: 15},
        centerWide: {lat: 0, lng: 0, zoom: 3},
        images: [],
        markers: {
            image: {
                layer: 'markers',
                lat: 0,
                lng: 0
            }
        },
        layers: {
            baselayers: {
                googleHybrid: angular.copy(mapService.layers.baselayers.googleHybrid)
            },
            overlays: {
                markers: {
                    type: 'group',
                    name: 'markers',
                    visible: true
                }

            }
        },
        buttons: _.sortBy(angular.copy(mappings.landUseType.choices), function (obj) {
            return obj.order; // custom defined orderring per Pardha
        })
    });

    function getMoreImages(page) {
        // Function gets images form the api with specific set of constraints to limit.
        // Gets a page of images
//        $http.get('https://api.croplands.org/api/images?'
//            + 'q={"order_by":[{"field":"date_acquired","direction":"desc"}'
//            + ',{"field":"classifications_count","direction":"asc"}],"filters":['
////            + '{"name":"classifications_majority_agreement","op":"lt","val":75},'
//            + '{"name":"classifications_count","op":"lt","val":30}'
//            + ']}'
//            + '&page=' + String(page)).then(function (response) {
//                $scope.images = $scope.images.concat(response.data.objects);
//                max_pages = response.data.total_pages;
//        });
        $http.get('https://api.croplands.org/api/images?'
            + 'q={"order_by":[{"field":"date_acquired","direction":"desc"}'
            + '],"filters":['
//            + '{"name":"classifications_majority_agreement","op":"lt","val":75},'
            + '{"name":"classifications_count","op":"lt","val":30}'
            + ']}'
            + '&page=' + String(page)).then(function (response) {
                $scope.images = $scope.images.concat(response.data.objects);
                max_pages = response.data.total_pages;
        });
    }

    function getImage() {
        // Function gets the next image from the array and moves the center of the map
        if ($scope.images.length > 0) {

            // Get next image and remove from array
            $scope.image = $scope.images[0];
            $scope.images = _.slice($scope.images, 1);
            console.log($scope.image.url);

            $scope.image.url = $scope.image.url.replace('images/', '');
            // Get coordinates of location and adjust maps
            $scope.center.lat = $scope.image.location.lat;
            $scope.center.lng = $scope.image.location.lon;
            $scope.center.zoom = 15;

            $scope.centerWide.lat = $scope.image.location.lat;
            $scope.centerWide.lng = $scope.image.location.lon;
            $scope.centerWide.zoom = 3;


            // Set marker
            $scope.markers.image.lat = $scope.image.location.lat;
            $scope.markers.image.lng = $scope.image.location.lon;
        }
    }

    // watch the number of images to classify and call function to get more as neccesary
    $scope.$watch(function () {
        return $scope.images.length;
    }, function (l, previous) {
        // first page
        if (previous === 0 && l > 0) {
            getImage();
        }
        // get next page
        if (l < 300 && max_pages >= page) {
            getMoreImages(page++);
        }
    });

    $scope.skip = function () {
        // User chooses not to classify image.
        getImage();
    };

    $scope.classify = function (classification_type) {
        // precondition that a classification type is defined
        if (classification_type !== undefined) {
            var data = {
                "classification": classification_type,
                "image": angular.copy($scope.image.id)
            };

            // post to api
            $http.post('https://api.croplands.org/api/image_classifications', data).then(function () {
                $scope.counter++;
            });
        }
        // go to the next image
        getImage();
    };

}]);;
app.controller("MapController", ['$scope', 'mapService', 'locationFactory', 'leafletData', '$timeout', '$window', '$location', 'mappings', 'log', function ($scope, mapService, locationFactory, leafletData, $timeout, $window, $location, mappings, log) {
    var selectionAreaMouseDownSubscription,
        selectionAreaClickSubscription,
        selectionAreaMousemoveSubscription;

    $location.moveCenter = function (lat, lng, zoom) {
        this.search(_.merge(this.search(), {lat: Math.round(lat * Math.pow(10, 5)) / Math.pow(10, 5), lng: lng, zoom: zoom}));
    };

    $location.setId = function (id) {
        this.search(_.merge(this.search(), {id: id}));
    };

    $location.removeId = function () {
        this.search(_.omit(this.search(), 'id'));
    };

    $location.getId = function () {
        return parseInt(_.pluck(this.search(), 'id'), 10);
    };

    $location.getCenter = function () {
        var parameters = this.search();
        if (parameters.lat && parameters.lng && parameters.zoom) {
            return {lat: parseFloat(parameters.lat),
                lng: parseFloat(parameters.lng),
                zoom: parseInt(parameters.zoom, 10)
            };
        }
    };

    ///////////
    // Utils //
    ///////////
    function disableMapDragging() {
        leafletData.getMap().then(function (map) {
            map.dragging.disable();
        });
    }

    function enableMapDragging() {
        leafletData.getMap().then(function (map) {
            map.dragging.enable();
        });
    }

    function stopPropagation(e) {
        L.DomEvent.stopPropagation(e);
    }


///////////////////////
// Listen for Events //
///////////////////////

    $scope.$on("locationFactory.markers.filtered", function () {
        log.info('Mapping ' + locationFactory.getFilteredRecordCount() + ' Locations', true);

        $scope.markers = locationFactory.markers;

        $scope.busy = false;
        $timeout(function () {
            $scope.busyDialogVisible = false;
        }, 10000);
    });
    $scope.$on("locationFactory.markers.downloaded", function () {
        log.info('Finished downloading location data.', true);
    });

    $scope.$on("locationFactory.markers.error", function () {
        log.info('Error downloading location data. Trying again...', true);
        $timeout(function () {
            locationFactory.getMarkers();
        }, 2000);
    });

    $scope.$watch(function () {
        return mapService.center;
    }, function (center) {
        $scope.center = center;
    }, true);


    $scope.$on('leafletDirectiveMarker.click', function (e, args) {
        // Args will contain the marker name and other relevant information
        $scope.loadMarker($scope.markers[args.markerName]);
    });

    $scope.$watch('center', function (center) {
        $location.moveCenter(center.lat, center.lng, center.zoom);
        console.log($scope.location);
        // If marker is no longer contained in bounds of map, drop from url parameters.
        if ($scope.location.lat && $scope.location.lon) {

            leafletData.getMap().then(function (map) {

                if (!map.getBounds().contains(L.latLng($scope.location.lat, $scope.location.lon))) {
                    // remove open marker since no long displayed
                    $location.removeId();
                    $scope.location.visible = false;
                }
            });
        } else {
            $location.removeId();
            $scope.location.visible = false;
        }
    });

    $scope.$watch('location', function (location) {
        if (location.visible && location.id > 0) {
            $location.setId(location.id);
        }
        else {
            $location.removeId();
        }
    }, true);

    $scope.$watch('busy', function () {
        if ($scope.busy) {
            $scope.busyDialogVisible = true;
        }
    });

    $scope.$on('location.record.edit.close', function () {
        $scope.closeRecordEditForm();
    });

    $scope.$on('location.record.edit.open', function (e, record) {
        $scope.record = record;


        // if coming from location panel, won't have lat/lon since that is not part of the
        // underlying data that gets downloaded
        if (record.lat && record.lon) {
            mapService.zoom(record.lat, record.lon, 15);
            console.log(mapService.center);
        }
        $timeout(function () {
            $scope.showRecordEditForm = true;
        }, 200);
        $scope.$broadcast('location.record.edit.close', record);

    });
    $scope.closeRecordEditForm = function () {
        $scope.showRecordEditForm = false;
        $scope.$broadcast('location.record.edit.inactive');
    };
///////////////////////
// Button Actions    //
///////////////////////
    $scope.selectArea = function (e) {

        // put selection back to 0,0
        $scope.paths.selection.latlngs[0] = {lat: 0, lng: 0};
        $scope.paths.selection.latlngs[1] = {lat: 0, lng: 0};

        // no selection has been created and no filtering of markers
        $scope.paths.selection.created = false;
        $scope.paths.selection.cropped = false;


        // toggle selection area control
        $scope.selectionAreaActive = !$scope.selectionAreaActive;

        // if selection active
        if ($scope.selectionAreaActive) {
            // get first corner
            selectionAreaMouseDownSubscription = $scope.$on('leafletDirectiveMap.mousedown', function (e, args) {
                disableMapDragging();

                $scope.paths.selection.latlngs[0] = {
                    lat: args.leafletEvent.latlng.lat,
                    lng: args.leafletEvent.latlng.lng };
                $scope.paths.selection.latlngs[1] = {
                    lat: args.leafletEvent.latlng.lat,
                    lng: args.leafletEvent.latlng.lng };

                // remove mousedown event listener
                selectionAreaMouseDownSubscription();
                // adjust selection mouse moves
                selectionAreaMousemoveSubscription = $scope.$on('leafletDirectiveMap.mousemove', function (e, args) {

                    $scope.paths.selection.latlngs[1] = {
                        lat: args.leafletEvent.latlng.lat,
                        lng: args.leafletEvent.latlng.lng };
                });
            });

            // capture second corner
            selectionAreaClickSubscription = $scope.$on('leafletDirectiveMap.click', function (e, args) {
                selectionAreaClickSubscription();
                if (selectionAreaMousemoveSubscription) {
                    selectionAreaMousemoveSubscription();
                }

                enableMapDragging();

                $scope.paths.selection.latlngs[1] = {
                    lat: args.leafletEvent.latlng.lat,
                    lng: args.leafletEvent.latlng.lng };
                $scope.paths.selection.created = true;
                $scope.selectionAreaActive = !$scope.selectionAreaActive;
            });


        }
    };

    $scope.filterBySelection = function (e) {

        $scope.busy = true;

        log.info('Filtering ' + locationFactory.getTotalRecordCount().toLocaleString() + ' Records', true);
        $timeout(function () {
            var bounds = {}, rect = $scope.paths.selection.latlngs;
            bounds.southWest = { lat: Math.min(rect[0].lat, rect[1].lat), lng: Math.min(rect[0].lng, rect[1].lng)};
            bounds.northEast = { lat: Math.max(rect[0].lat, rect[1].lat), lng: Math.max(rect[0].lng, rect[1].lng)};
            locationFactory.filters.byPolygon(bounds, true, true);
            // put selection back to 0,0
            $scope.paths.selection.latlngs[0] = {lat: 0, lng: 0};
            $scope.paths.selection.latlngs[1] = {lat: 0, lng: 0};

            // no selection has been created and no filtering of markers
            $scope.paths.selection.created = false;
            $scope.paths.selection.cropped = false;
        }, 200);


    };

    $scope.toggleLayerInfo = function (layer, e) {
        e.preventDefault();
        stopPropagation(e);
        layer.infoVisible = !layer.infoVisible;
    };

    $scope.zoomExtent = function () {
        mapService.center.lat = 0;
        mapService.center.lng = 0;
        mapService.center.zoom = 2;
    };
    $scope.refreshLocations = function () {
        log.info('Loading Location Data', true);
        $scope.busy = true;

        locationFactory.getMarkers();
    };


    $scope.loadMarker = function (m) {
        if (m.location_id) {
            log.info("Loading Marker, ID: " + m.data_id, true);

            // Save id in url parameter
            $location.setId($scope.location.data_id);
        }

        // Save marker location
        $scope.location = _.clone(m, true);

        $scope.location.visible = true;

        // Call function to move to marker
        $scope.goToMarker(m);
    };


    $scope.goToMarker = function (m, e, ignoreBounds) {
        if (ignoreBounds) {
            // Zoom in if not already
            if (mapService.center.zoom < 13) {
                mapService.center.lat = m.lat;
                mapService.center.lng = m.lon;
                mapService.center.zoom = 16;
            } else {
                mapService.center.zoom += 1;
            }

        } else {
            // Pan map if marker not within bounds of map
            leafletData.getMap().then(function (map) {
                if (!map.getBounds().contains(L.latLng(m.lat, m.lon))) {
                    mapService.center.lat = m.lat;
                    mapService.center.lng = m.lon;
                }
            });
        }
    };


    $scope.resetGroundData = function () {
        log.info('Clearing Selection on Locations', true);
        $scope.busy = true;
        locationFactory.cf.dims.spatial.filterAll();
        locationFactory.returnMarkers();

    };

    $scope.downloadLocations = function () {
        var blob = new Blob([locationFactory.getCSV()], {type: "data:application/csv;charset=utf-8", endings: 'native'});
        var filename = "GFSAD-Locations-" + Math.round(new Date() / 1000) + ".csv";
        saveAs(blob, filename);
    };

    $scope.print = function () {
        window.print();
    };

    $scope.addLocation = function (e) {
        $scope.addLocationActive = true;
        var mapClickSubscription = $scope.$on('leafletDirectiveMap.click', function (e, args) {
            mapClickSubscription();
            $scope.loadMarker({lat: args.leafletEvent.latlng.lat, lon: args.leafletEvent.latlng.lng});
            $scope.addLocationActive = false;
        });
    };

// Add to scope
    $scope.disableMapDragging = disableMapDragging;
    $scope.enableMapDragging = enableMapDragging;
    $scope.stopPropagation = stopPropagation;


//////////
// Init //
//////////

    function init() {
//        requestFullscreen($("#map-app"));
        var defaults = {
            tableOfContentsVisible: true,
            selectionAreaActive: false,
            addLocationActive: false,
            showHelp: false,
            showDownloadModal: false,
            busy: false,
            busyDialogVisible: false,
            mappings: mappings,
            location: {
                visible: false
            },
            filters: {
                visible: false,
                activeFilters: {}
            },
            table: {
                visible: false
            },
            events: {
                map: {
                    enable: ['mousedown', 'mousemove', 'click'],
                    logic: 'emit'
                },
                marker: {
                    enable: ['click'],
                    logic: 'emit'
                }
            },
            markers: [],
            center: mapService.center,
            paths: mapService.paths,
//            layers: angular.copy(mapService.layers)
            layers: mapService.layers
        };


        // Load Url Parameters if Found
        var center = $location.getCenter();
        if (center && center.lat) {
            mapService.center.lat = center.lat;
        }
        if (center && center.lng) {
            mapService.center.lng = center.lng;
        }
        if (center && center.zoom) {
            mapService.center.zoom = center.zoom;
        }


        if ($location.getId()) {
            defaults.location.id = $location.getId();
            defaults.location.visible = true;
        }


        // See if browser can download files
        if (!!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/)) {
            defaults.canDownloadFiles = false;
        } else {
            try {
                defaults.canDownloadFiles = !!new Blob;
            } catch (e) {
                defaults.canDownloadFiles = false;
            }
        }

        // Apply defaults
        angular.extend($scope, defaults);

        // Get Locations
        $scope.refreshLocations();
    }

    init();


    $scope.layers.overlays.africa.visible = true;
    $scope.layers.overlays.australia.visible = true;

}]);;
app.controller("NavbarController", ['$scope', 'User', '$location', function ($scope, User, $location) {
    $scope.goToLogin = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/login').search({n: n});
    };

    $scope.isLoggedIn = function () {
        return User.isLoggedIn();
    };

    $scope.goToLogout = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/logout').search({n: n});
    };
}]);;
app.controller("ConfirmController", ['$scope', 'log', function ($scope, log) {

}]);;
app.controller("ForgotController", ['$scope', 'User', function ($scope, User) {
    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.forgot = function () {
        $scope.busy = true;
        User.forgot($scope.email).then(function (response) {
            setMessage(response.description, true);
            $scope.busy = false;
            $scope.email = '';
        }, function (response) {
            if (response.description) {
                setMessage(response.description, false);
            }
            else {
                setMessage('Something went wrong', false);
            }
            $scope.busy = false;
        });
    };
}]);;
app.controller("LoginController", ['$scope', 'log', 'User', '$timeout', '$location', function ($scope, log, User, $timeout, $location) {

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.login = function (valid) {
        $scope.message = null;

        $scope.busy = true;
        if (!valid) {
            setMessage('Invalid Data', false);
            return;
        }
        User.login($scope.email, $scope.password).then(function () {
            setMessage('You have successfully logged in.', true);
            $scope.busy = false;
            $scope.email = '';
            $scope.password = '';

            var next = JSON.parse(window.atob(decodeURIComponent($location.search().n)));
            if (next) {
                $location.path(next.path).search(next.params);
            } else {
                $location.path('/app').search();
            }

        }, function (response) {
            if (response.description) {
                setMessage(response.description, false);
            }
            else {
                setMessage('Something went wrong', false);
            }
            $scope.busy = false;
        });
    };

}]);;
app.controller("LogoutController", ['$scope', 'User', '$location', function ($scope, User, $location) {
    User.logout();

    var next = JSON.parse(window.atob(decodeURIComponent($location.search().n)));
    if (next) {
        $location.path(next.path).search(next.params);
    }
}]);;
app.controller("RegisterController", ['User', 'countries', '$scope','$location', function (User, countries, $scope, $location) {

    if (User.isLoggedIn()) {
         var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/logout').search({n: n});
    }

    angular.extend($scope, {
        countries: countries,
        success: null,
        message: null
    });

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    // Get List of Countries
    $scope.countries = countries;

    $scope.register = function () {
        $scope.busy = true;
        User.register($scope.registration)
            .then(function (response) {
                $scope.busy = false;
                setMessage(response.description, true);

            }, function (response) {
                if (response) {
                    setMessage(response.description, false);
                }
                else {
                    setMessage('Something went wrong', false);
                }
                $scope.busy = false;
            });
    };

}]);;
app.controller("ResetController", ['$location', '$scope', 'log', '$window', function ($location, $scope, log, $window) {
    $scope.token = $location.search().token;
    var path = $location.path().split('/');

    if (path[1] === 'account') {
        $scope.$emit('user.' + path[2], true);
    } else {
        log.info('not account/reset');
//        $window.location.href = '/';
    }
    if ($scope.token === undefined) {
        log.warn('Token not found');
//        $window.location.href = '/';
    }
}]);;
app.directive('blur', [function () {
    return {
        restrict: 'A',
        link: function (scope, element) {
            element.on('click', function () {
                element.blur();
            });
        }
    };
}]);;
app.directive('filter', ['locationFactory', 'log', '$q', '$timeout', 'mappings', function (locationFactory, log, $q, $timeout, mappings) {
    function reset(scope, callback) {
        log.info("Resetting Filters");

        _.each(scope.years, function (year) {
            year.selected = year.label === 2015;
        });

        _.each(scope.landUseType, function (type) {
            type.selected = true;
        });

        _.each(scope.crops, function (crop) {
            crop.selected = true;
        });

        _.each(scope.intensity, function (intensity) {
            intensity.selected = true;
        });

        _.each(scope.water, function (water) {
            water.selected = true;
        });
        if (callback) {
            callback();
        }
    }

    function getSelectedFieldValues(field) {
        return _.pluck(_.where(field, {selected: true}), 'id');
    }

    function apply(scope) {
        log.info("Filtering Locations");

        scope.$parent.busy = true;
        $timeout(function () {
            locationFactory.cf.dims.year.filterAll();
            locationFactory.cf.dims.landUseType.filterAll();
            locationFactory.cf.dims.crop.filterAll();
            locationFactory.cf.dims.intensity.filterAll();
            locationFactory.cf.dims.water.filterAll();

            scope.activeFilters = {
                years: getSelectedFieldValues(scope.years),
                landUseType: getSelectedFieldValues(scope.landUseType),
                crops: getSelectedFieldValues(scope.crops),
                intensity: getSelectedFieldValues(scope.intensity),
                water: getSelectedFieldValues(scope.water)
            };

            locationFactory.filters.years(_.indexBy(scope.years, 'label'));
            locationFactory.filters.landUseType(_.indexBy(scope.landUseType, 'label'));
            locationFactory.filters.crops(_.indexBy(scope.crops, 'label'));
            locationFactory.filters.intensity(_.indexBy(scope.intensity, 'label'));
            locationFactory.filters.water(_.indexBy(scope.water, 'label'));

            locationFactory.returnMarkers();

        }, 100);
    }


    return {
        restrict: 'EA',
        scope: {
            visible: '=visible',
            activeFilters: '=activeFilters'
        },
        link: function (scope) {
            scope.landUseType = angular.copy(mappings.landUseType.choices);
            scope.crops = angular.copy(mappings.crop.choices);
            scope.intensity = angular.copy(mappings.intensity.choices);
            scope.water = angular.copy(mappings.water.choices);
            scope.years = [];

            var currentYear = new Date().getFullYear();
            for (var i = 2000; i < currentYear + 1; i++) {
                scope.years.push({label: i, id: i});
            }


            // Listeners
            scope.$on("locationFactory.markers.filtered", function () {
                scope.countAll = locationFactory.getTotalRecordCount();
                scope.countFiltered = locationFactory.getFilteredRecordCount();
                scope.filters = locationFactory.filters.list;
            });

            scope.$on("locationFactory.markers.downloaded", function () {
                apply(scope);
            });

            // Scope Methods
            scope.reset = function () {
                reset(scope);
            };
            scope.apply = function () {
                apply(scope);
            };

            scope.allOptionsAreSelected = function (field) {
                if (field === undefined) {
                    return false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    if (!scope[field][i].selected) {
                        return false;
                    }
                }
                return true;
            };

            scope.toggleAllOptions = function (field) {
                var selected = true;
                if (scope.allOptionsAreSelected(field)) {
                    selected = false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    scope[field][i].selected = selected;
                }
            };

            // Initialized Default Filters
            reset(scope, function () {
                log.info("Applying filters to locations", true);
                apply(scope);
            });
        },
        templateUrl: '/static/directives/filter.html'
    };

}]);;
app.directive('forgotForm', ['user', 'log', '$timeout', function (user, log, $timeout) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {
            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
            }

            scope.forgot = function () {
                scope.login.busy = true;
                user.forgot(scope.email).then(function (response) {
                    setMessage(response.description, true);
                    scope.busy = false;
                    scope.email = '';
                }, function (response) {
                    if (response.description) {
                        setMessage(response.description, false);
                    }
                    else {
                        setMessage('Something went wrong', false);
                    }
                    scope.busy = false;
                });
            };

            scope.login = function () {
                scope.$emit('user.forgot', false);
                scope.$emit('user.login', true);
            };

            scope.register = function () {
                scope.$emit('user.forgot', false);
                scope.$emit('user.register', true);
            };

            scope.close = function () {
                scope.$emit('user.forgot', false);
            };
        },
        templateUrl: '/static/directives/forgot.html'
    };

}]);;
app.directive('images', [function () {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        link: function (scope) {
            scope.$watch('items', function (val) {
                if (val && val.length > 0) {
                    scope.active = scope.items[0];
                }
                else {
                    scope.active = null;
                }
            });
            scope.src = function (url) {
                if(url) {
                    // use first directory to make subdomain
                    return "http://images.croplands.org" + url.replace('images/','/');
                }
            };

            scope.changeLeadPhoto = function (index) {
                scope.modal = true;
                scope.active = scope.items[index];
            };

            scope.closeModal = function () {
                scope.modal = false;
            };
        },
        templateUrl: '/static/directives/images.html'
    };

}]);;
app.directive('legend', [function () {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        templateUrl: '/static/directives/legend.html'
    };
}]);;
app.directive('location', ['locationFactory', 'mappings', 'leafletData', 'icons', 'mapService', 'log', '$q', 'geoHelperService', function (locationFactory, mappings, leafletData, icons, mapService, log, $q, geoHelperService) {
    var activeTab = 'help',
        gridImageURL = "/static/imgs/icons/grid.png", shapes = {};


    return {
        restrict: 'E',
        scope: {
            lat: '=lat',
            lon: '=lon',
            id: '=locationId',
            visible: '=visible'
        },
        link: function (scope) {

            scope.init = function() {
                // reset location data
                scope.location = {};

                // use same tab as before
                scope.activeTab = activeTab;

                // get children elements if id is present and make copy
                if (scope.id && scope.id !== 0) {

                    // Mark panel as busy
                    scope.busy = true;

                    // Get detailed data
                    locationFactory.getLocation(scope.id, function (data) {
                        // Save data plus original to detect changes
                        scope.location = data;
                        scope.copy = angular.copy(scope.location);

                        // Location panel is no longer busy
                        scope.busy = false;

                        // Copy lat lon back for parent etc...
                        scope.lat = data.lat;
                        scope.lon = data.lon;

                        scope.buildShapes([scope.lat, scope.lon], scope.location.points, scope.location.bearing);
                    });
                } else {
                    // if no id, just save location
                    scope.location.lat = scope.lat;
                    scope.location.lon = scope.lon;
                }

                if (scope.lat && scope.lon) {
                    scope.buildShapes([scope.lat, scope.lon]);
                }
                else {
                    scope.clearShapes();
                }


            };

            scope.clearShapes = function() {
                var deferred = $q.defer();
                // remove various layers from map and delete reference
                leafletData.getMap().then(function (map) {
                    _.forOwn(shapes, function (shape, key) {
                        log.info('[Location] Removing ' + key + ' from map.');
                        map.removeLayer(shape);
                    });
                    shapes = {};
                    deferred.resolve();
                });

                return deferred.promise;
            };

            scope.buildGrid = function(latLng) {
                leafletData.getMap().then(function (map) {
                    try {
                        map.removeLayer(shapes.locationAreaGrid);
                    } catch (e) {
                        log.debug('[Location] Area Grid Does Not Exist');
                    }
                    var circle250 = L.circle(latLng, 125, {fill: false, dashArray: [3, 6], color: '#00FF00'});//
                    shapes.locationAreaGrid = L.imageOverlay(gridImageURL, circle250.getBounds());
                    map.addLayer(shapes.locationAreaGrid);
                });
            };

            scope.buildShapes = function (latLng, points, bearing) {
                scope.clearShapes().then(function () {

                    scope.buildGrid(latLng);

                    shapes.locationMarker = L.marker(latLng, {icon: new L.icon(icons.iconRedSelected), zIndexOffset: 1000, draggable: true});

                    shapes.locationMarker.on('dragend', function (event) {
                        log.info('[Location] Dragged marker: ' + event.distance + ' meters');
                        scope.buildGrid(shapes.locationMarker.getLatLng());
                        latLng = shapes.locationMarker.getLatLng();
                        scope.location.lat = latLng.lat;
                        scope.location.lon = latLng.lng;
                    });

                    if (bearing && bearing >= 0) {
                        shapes.polygon = L.polygon([latLng, geoHelperService.destination(latLng, bearing - 20, 0.2), geoHelperService.destination(latLng, bearing + 20, 0.2)], {color: '#00FF00', stroke: false, opacity: 0.4});
                    }

                    if (points) {
                        _.each(points, function (pt, i) {
                            var opacity = 0.5 / points.length;
                            opacity = Math.min(opacity * 20 / pt.accuracy, 0.5);
                            shapes["gpsPoint_#" + i] = L.circle([pt.lat, pt.lon], pt.accuracy, {stroke: false, opacity: opacity, fillOpacity: opacity, fill: true, color: '#00FF00'});
                        });

                    }

                    leafletData.getMap().then(function (map) {
                        _.forOwn(shapes, function (shape) {
                            shape.addTo(map);
                        });

                    });
                });
            };

            // add some other values to scope
            angular.extend(scope, {
                mappings: mappings,
                allowedYears: _.range(2000, new Date().getFullYear() + 1),
                allowedMonths: _.range(1, 13),
                busy: false,
                location: {
                    records: []
                }
            });

            // Some methods
            scope.close = function () {
                scope.visible = false;
            };

            scope.changeActiveTab = function (tab) {
                activeTab = tab;
                scope.activeTab = tab;
            };

            scope.addRecordRow = function (e) {
                log.info('Creating new record.', true);
                var d = new Date(),
                    record = {
                        year: d.getFullYear(),
                        month: d.getMonth(),
                        lat: scope.location.lat,
                        lon: scope.location.lon,
                        location_id: scope.location.id,
                        land_use_type: 0,
                        water: 0,
                        intensity: 0,
                        crop_primary: 0,
                        crop_secondary: 0
                    };

                if (scope.id === undefined) {
                    locationFactory.postLocation({lat: scope.lat, lon: scope.lon})
                        .success(function (data) {
                            scope.location = data;
                            scope.id = data.id;
                            record.location_id = data.id;

                            scope.location.records.push(record);
                            scope.$emit('location.record.edit.open', record);

                        }).error(function () {
                            log.info("Something went wrong creating the location.");
                        });
                } else {
                    // append record and open edit
                    scope.location.records.push(record);
                    scope.$emit('location.record.edit.open', record);
                }
            };


            scope.zoom = function () {
                mapService.zoom(scope.lat, scope.lon, 16);
            };

            // Watch for new location
            scope.$watch(function () {
                    return [scope.lat, scope.lon];
                }, function (position) {
                    console.log(position);
                    scope.init();
                }, true
            );
            scope.$watch('visible', function (visible) {
                if (!visible) {
                    scope.clearShapes();
                }
            });
        },
        templateUrl: '/static/directives/location.html'
    };


}]);
;
app.directive('locationRecord', ['mapService', 'RatingService','User', function (mapService, RatingService, User) {
    return {
        restrict: 'EA',
        scope: {
            record: '=record',
            showZoom: '=showZoom'
        },
        link: function (scope) {
            console.log(scope.record);
            // do nothing
            scope.edit = function () {
                scope.$emit('location.record.edit.open', scope.record);
                scope.showEditForm = true;
            };
            scope.$on('location.record.edit.inactive', function () {
                    scope.showEditForm = false;
            });
            scope.zoom = function () {
                if (scope.record.lat && scope.record.lon) {
                    mapService.zoom(scope.record.lat, scope.record.lon, 16);
                }
            };

            scope.thumbsUp = function () {
                RatingService.rateRecord(scope.record, 1);
            };
            scope.thumbsDown = function () {
                RatingService.rateRecord(scope.record, -1);
            };

            scope.getUserRating = function () {
                if (scope.record.user_rating === undefined) {
                    return 0;
                }
                return scope.record.user_rating.rating;
            };

            scope.User = User;

        },
        templateUrl: '/static/directives/location-record.html'
    };
}]);;
app.directive('locationRecordEditForm', ['locationFactory', 'mappings', 'User', function (locationFactory, mappings, User) {
    return {
        restrict: 'EA',
        scope: {
            record: '=record'
        },
        link: function (scope) {
            scope.original = angular.copy(scope.record);
            // Build the options
            scope.landUseTypes = mappings.landUseType.choices;
            scope.crops = mappings.crop.choices;
            scope.intensity = mappings.intensity.choices;
            scope.water = mappings.water.choices;
            scope.sources = mappings.source.choices;
            scope.confidence = mappings.confidence.choices;
            scope.years = [];

            var currentYear = new Date().getFullYear();
            for (var i = 2000; i < currentYear + 1; i++) {
                scope.years.push({label: i, id: i});
            }


            scope.save = function (){
                console.log(scope.record);

                locationFactory.saveRecord(scope.record).then(function (data) {
                    scope.$emit('location.record.edit.close');
                    _.merge(scope.record, data);
                });

            };

            scope.cancel = function () {
                scope.$emit('location.record.edit.close');
            };

        },
        templateUrl: '/static/directives/location-record-edit-form.html'
    };
}]);;
app.directive('locationRecordList', ['$window', function ($window) {
    return {
        restrict: 'EA',
        scope: {
            records: '=records',
            page: '=page',
            pageSize: '=pageSize',
            showZoom: '=showZoom'
        },
        link: function (scope) {
            _.sortBy(scope.records, function (r) {
                return r.year*100 + r.month;
            });

            scope.pagedRecords = [];
            if (scope.page === undefined) {
                scope.page = 0;
            }

            if (scope.showZoom === undefined) {
                scope.showZoom = false;
            }

            if (scope.pageSize === undefined) {
                if ($window.screen.height) {
                    scope.pageSize = Math.max(Math.floor(($window.screen.height - 750) / 20), 5);
                } else {
                    scope.pageSize = 8;
                }
            }


            scope.makePages = function () {
                scope.pagedRecords = [];
                if (!scope.records || !scope.records.length) {
                    return;
                }
                for (var i = 0; i < scope.records.length; i++) {
                    // Build array if page is empty
                    if (i % scope.pageSize === 0) {
                        scope.pagedRecords[Math.floor(i / scope.pageSize)] = [ scope.records[i] ];
                    } else { // append to existing page
                        scope.pagedRecords[Math.floor(i / scope.pageSize)].push(scope.records[i]);
                    }
                }
            };

            scope.range = function (start, end) {
                var ret = [];
                if (!end) {
                    end = start;
                    start = 0;
                }
                for (var i = start; i < end; i++) {
                    ret.push(i);
                }
                return ret;
            };

            scope.setPage = function (page) {
                if (page !== undefined) {
                    scope.page = page;
                }
            };

            scope.previous = function () {
                if (scope.page > 0) {
                    scope.page--;
                }
            };

            scope.next = function () {
                if (scope.pagedRecords.length > scope.page + 1) {
                    scope.page++;
                }
            };

            scope.$watch(function () {
                if (scope.records) {
                    return scope.records.length;
                }
                return 0;
            }, function () {
                scope.makePages();
            });



        },
        templateUrl: '/static/directives/location-record-list.html'
    };
}]);;
app.directive('log', ['log', function (log) {
    return {
        link: function (scope) {
            scope.list = log.getLog();
            scope.$watch(function () {
                return log.getLog();
            }, function (val) {
                scope.list = val;
            }, true);
        },
        templateUrl: '/static/directives/log.html'
    };
}]);
;
app.directive('loginForm', ['user', 'log', '$timeout', function (user, log, $timeout) {
    return {
        restrict: 'E',
        $scope: {
        },
        link: function ($scope) {
            function setMessage(message, success) {
                $scope.success = success;
                $scope.message = message;
                $timeout(function () {
                    $scope.success = '';
                    $scope.message = '';
                }, 4000);
            }

            $scope.login = function (valid) {
                $scope.login.busy = true;
                if (!valid) {
                    setMessage('Invalid Data', false);
                    return;
                }
                user.login($scope.email, $scope.password).then(function (response) {
                    setMessage(response.description, true);
                    $scope.busy = false;
                    $scope.$emit('user.login', false);
                    $scope.email = '';
                    $scope.password = '';
                }, function (response) {
                    if (response.description) {
                        setMessage(response.description, false);
                    }
                    else {
                        setMessage('Something went wrong', false);
                    }
                    $scope.busy = false;
                });
            };

            $scope.forgot = function () {
                $scope.$emit('user.login', false);
                $scope.$emit('user.forgot', true);
            };

            $scope.register = function () {
                $scope.$emit('user.login', false);
                $scope.$emit('user.register', true);
            };

            $scope.loginClose = function () {
                $scope.$emit('user.login', false);
            };
        },
        templateUrl: '/static/directives/login.html'
    };

}]);;
app.directive('ndvi', ['$http', '$log', '$q', function ($http, $log, $q) {
    var URL = 'https://api.croplands.org/gee/time_series',
        series = {};
    var canceller = $q.defer();

    var colors = {
        2000: "#1f77b4",
        2001: "#aec7e8",
        2002: "#ff7f0e",
        2003: "#ffbb78",
        2004: "#2ca02c",
        2005: "#98df8a",
        2006: "#d62728",
        2007: "#ff9896",
        2008: "#9467bd",
        2009: "#c5b0d5",
        2010: "#8c564b",
        2011: "#c49c94",
        2012: "#e377c2",
        2013: "#f7b6d2",
        2014: "#7f7f7f",
        2015: "#c7c7c7",
        2016: "#bcbd22",
        2017: "#dbdb8d",
        2018: "#17becf",
        2019: "#9edae5"
    };

    function hashISODate(date_str) {
        // returns year and a period of the year where each month is divided into three parts with a 0 index
        var year = parseInt(date_str.substring(0, 4), 10),
            month = parseInt(date_str.substring(5, 7), 10) - 1,
            day = parseInt(date_str.substring(8, 10), 10),
            period;

        period = month * 3 + Math.min(2, parseInt(day / 10, 10)); // 3*[0-12] + [0-2]
        return [year, period];
    }

    function queryData(lat, lon, scope) {
        scope.ndviBusy = true;
        // reset series
        series = {};

        // add parameters to url
        var _url = URL + '?';
        if (lat) {
            _url += 'lat=' + String(lat) + '&';
        }
        if (lon) {
            _url += 'lon=' + String(lon) + '&';
        }
        _url += 'date_start=2004-01-01&';

        $http({method: 'GET', url: _url, timeout: canceller, transformRequest: function (data, headersGetter) {
            var headers = headersGetter();
            delete headers.authorization;
            return headers;
        }}).
            success(function (data) {
                series = {};
                _.each(data.results, function (item) {
                    var hash = hashISODate(item.date);
                    // if year not in series
                    if (series[hash[0]] === undefined) {
                        series[hash[0]] = {
                            points: '',
                            active: '',
                            color: colors[hash[0]]
                        };
                    }
                    // append data point to year series
                    if (item.hasOwnProperty('ndvi')) {
                        series[hash[0]].points += (String((hash[1] * 10) + 40) + "," + String(Math.abs(205 - (item.ndvi / 10000 * 210)))) + " ";
                    }
                });
                scope.series = series;
                scope.ndviBusy = false;
            }
        );
    }

    return {
        restrict: 'E',
        scope: {
            lat: '=lat',
            lon: '=lon'
        },
        link: function (scope) {
            scope.$watch(function () {
                return [scope.lat, scope.lon];
            }, function (pt) {
                if (pt[0] && pt[1]) {
                    canceller.resolve("new location");
                    queryData(pt[0], pt[1], scope);
                }
            }, true);


            scope.activate = function (year) {
                _.forOwn(scope.series, function (y, k) {
                    if (k === year) {
                        y.class = 'active';
                    } else {
                        y.class = 'inactive';
                    }
                });
            };

            scope.deactivate = function () {
                _.forOwn(scope.series, function (y) {
                    y.class = '';
                });
            };

        },
        templateUrl: '/static/directives/ndvi.html'
    };

}])
;;
app.directive('passwordConfirm', ['$window', function ($window) {
    var obvious = ['crops', 'cropland', 'rice', 'usgs', 'nasa', 'corn', 'wheat', 'landsat', 'modis'];

    return {
        restrict: 'EA',
        scope: {
            valid: '=valid',
            minEntropy: '=minEntropy',
            password: '=password'
        },
        link: function (scope) {
            if (scope.minEntropy === undefined) {
                scope.minEntropy = 30;
            }

            // init values
            scope.entropy = 0;

            scope.passwordsMatch = function () {
                return scope.password === scope.confirm;
            };

            scope.passwordIsStrong = function () {
                return scope.entropy > scope.minEntropy;
            };

            scope.$watch('password', function (pass) {
                if ($window.zxcvbn === undefined) {
                    scope.entropy = 0;
                    return;
                }

                if (pass && pass.length >= 8) {
                    scope.entropy = zxcvbn(pass, obvious).entropy;
                }
                else {
                    scope.entropy = 0;
                }
            });

            scope.$watch(function () {
                return scope.passwordIsStrong() && scope.passwordsMatch();
            }, function (val) {
                scope.valid = val;
            });
        },
        templateUrl: '/static/directives/password-confirm.html'
    }
        ;
}])
;
;
app.directive('resetForm', ['user', '$window', '$timeout', function (user, $window, $timeout) {
    return {
        restrict: 'E',
        scope: {
            token: '=token'
        },
        link: function (scope) {
            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
            }

            scope.reset = function () {
                scope.busy = true;
                user.reset(scope.password, scope.token).then(function (response) {
                    setMessage(response.description, true);
                    scope.busy = false;
                    scope.close();
                }, function (response) {
                    if (response.description) {
                        setMessage(response.description, false);
                    }
                    else {
                        setMessage('Something went wrong', false);
                    }
                    scope.busy = false;
                });
            };

            scope.close = function () {
                $window.location.href='/';
            };
        },
        templateUrl: '/static/directives/reset.html'
    };

}]);;
app.directive('tableOfContents', ['mapService', 'leafletData', function (mapService, leafletData) {
    return {
        templateUrl: '/static/directives/table-of-contents.html',
        scope: {
            expandBackgroundLayers: '@',
            expandProductLayers: '@',
            expandOtherLayers: '@'
        }, link: function (scope) {
            scope.layers = scope.layers === undefined ? mapService.layers : scope.layers;

            scope.changeBaseLayer = function (key) {
                leafletData.getMap().then(function (map) {
                    leafletData.getLayers().then(function (layers) {
                        _.each(layers.baselayers, function (layer) {
                            map.removeLayer(layer);
                        });
                        map.addLayer(layers.baselayers[key]);
                    });
                });
            };
        }
    };
}
]);

;
app.directive('tableOfContentsLayer', [function () {
    return {
        templateUrl: '/static/directives/table-of-contents-layer.html',
        scope: {
            layer: '=',
            showMore: '@'
        }, link: function (scope) {
            scope.showMore = scope.showMore === undefined ? false : scope.showMore;

            scope.isPlaying = function () {
                return scope.layer.loop !== undefined;
            };

            scope.toggleShowMore = function () {
                if (scope.canShowMore()) {
                    scope.showMore = !scope.showMore;
                }
            };
            scope.canShowMore = function () {
                return scope.layer.years || scope.layer.legend;
            };
        }
    };
}
]);

