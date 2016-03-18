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

            var base64icon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAGmklEQVRYw7VXeUyTZxjvNnfELFuyIzOabermMZEeQC/OclkO49CpOHXOLJl/CAURuYbQi3KLgEhbrhZ1aDwmaoGqKII6odATmH/scDFbdC7LvFqOCc+e95s2VG50X/LLm/f4/Z7neY/ne18aANCmAr5E/xZf1uDOkTcGcWR6hl9247tT5U7Y6SNvWsKT63P58qbfeLJG8M5qcgTknrvvrdDbsT7Ml+tv82X6vVxJE33aRmgSyYtcWVMqX97Yv2JvW39UhRE2HuyBL+t+gK1116ly06EeWFNlAmHxlQE0OMiV6mQCScusKRlhS3QLeVJdl1+23h5dY4FNB3thrbYboqptEFlphTC1hSpJnbRvxP4NWgsE5Jyz86QNNi/5qSUTGuFk1gu54tN9wuK2wc3o+Wc13RCmsoBwEqzGcZsxsvCSy/9wJKf7UWf1mEY8JWfewc67UUoDbDjQC+FqK4QqLVMGGR9d2wurKzqBk3nqIT/9zLxRRjgZ9bqQgub+DdoeCC03Q8j+0QhFhBHR/eP3U/zCln7Uu+hihJ1+bBNffLIvmkyP0gpBZWYXhKussK6mBz5HT6M1Nqpcp+mBCPXosYQfrekGvrjewd59/GvKCE7TbK/04/ZV5QZYVWmDwH1mF3xa2Q3ra3DBC5vBT1oP7PTj4C0+CcL8c7C2CtejqhuCnuIQHaKHzvcRfZpnylFfXsYJx3pNLwhKzRAwAhEqG0SpusBHfAKkxw3w4627MPhoCH798z7s0ZnBJ/MEJbZSbXPhER2ih7p2ok/zSj2cEJDd4CAe+5WYnBCgR2uruyEw6zRoW6/DWJ/OeAP8pd/BGtzOZKpG8oke0SX6GMmRk6GFlyAc59K32OTEinILRJRchah8HQwND8N435Z9Z0FY1EqtxUg+0SO6RJ/mmXz4VuS+DpxXC3gXmZwIL7dBSH4zKE50wESf8qwVgrP1EIlTO5JP9Igu0aexdh28F1lmAEGJGfh7jE6ElyM5Rw/FDcYJjWhbeiBYoYNIpc2FT/SILivp0F1ipDWk4BIEo2VuodEJUifhbiltnNBIXPUFCMpthtAyqws/BPlEF/VbaIxErdxPphsU7rcCp8DohC+GvBIPJS/tW2jtvTmmAeuNO8BNOYQeG8G/2OzCJ3q+soYB5i6NhMaKr17FSal7GIHheuV3uSCY8qYVuEm1cOzqdWr7ku/R0BDoTT+DT+ohCM6/CCvKLKO4RI+dXPeAuaMqksaKrZ7L3FE5FIFbkIceeOZ2OcHO6wIhTkNo0ffgjRGxEqogXHYUPHfWAC/lADpwGcLRY3aeK4/oRGCKYcZXPVoeX/kelVYY8dUGf8V5EBRbgJXT5QIPhP9ePJi428JKOiEYhYXFBqou2Guh+p/mEB1/RfMw6rY7cxcjTrneI1FrDyuzUSRm9miwEJx8E/gUmqlyvHGkneiwErR21F3tNOK5Tf0yXaT+O7DgCvALTUBXdM4YhC/IawPU+2PduqMvuaR6eoxSwUk75ggqsYJ7VicsnwGIkZBSXKOUww73WGXyqP+J2/b9c+gi1YAg/xpwck3gJuucNrh5JvDPvQr0WFXf0piyt8f8/WI0hV4pRxxkQZdJDfDJNOAmM0Ag8jyT6hz0WGXWuP94Yh2jcfjmXAGvHCMslRimDHYuHuDsy2QtHuIavznhbYURq5R57KpzBBRZKPJi8eQg48h4j8SDdowifdIrEVdU+gbO6QNvRRt4ZBthUaZhUnjlYObNagV3keoeru3rU7rcuceqU1mJBxy+BWZYlNEBH+0eH4vRiB+OYybU2hnblYlTvkHinM4m54YnxSyaZYSF6R3jwgP7udKLGIX6r/lbNa9N6y5MFynjWDtrHd75ZvTYAPO/6RgF0k76mQla3FGq7dO+cH8sKn0Vo7nDllwAhqwLPkxrHwWmHJOo+AKJ4rab5OgrM7rVu8eWb2Pu0Dh4eDgXoOfvp7Y7QeqknRmvcTBEyq9m/HQQSCSz6LHq3z0yzsNySRfMS253wl2KyRDbcZPcfJKjZmSEOjcxyi+Y8dUOtsIEH6R2wNykdqrkYJ0RV92H0W58pkfQk7cKevsLK10Py8SdMGfXNXATY+pPbyJR/ET6n9nIfztNtZYRV9XniQu9IA2vOVgy4ir7GCLVmmd+zjkH0eAF9Po6K61pmCXHxU5rHMYd1ftc3owjwRSVRzLjKvqZEty6cRUD7jGqiOdu5HG6MdHjNcNYGqfDm5YRzLBBCCDl/2bk8a8gdbqcfwECu62Fg/HrggAAAABJRU5ErkJggg==";

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
        }).when('/app/data', {
            templateUrl: '/static/templates/data.html',
            controller: 'DataController'
        }).when('/app/data/search', {
            templateUrl: '/static/templates/data/search.html',
            controller: 'DataSearchController',
            reloadOnSearch: false
        }).when('/app/data/record', {
            templateUrl: '/static/templates/data/record.html',
            controller: 'DataRecordController'
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
        'http://127.0.0.1:8000/**',
        'https://api.croplands.org/**'
    ]);
}]);
;
app.factory('DataRecord', ['mappings', '$http', '$rootScope', '$q', 'DataService', 'log', 'User', '$location', function (mappings, $http, $rootScope, $q, DataService, log, User, $location) {
    var _baseUrl = 'https://api.croplands.org',
        record = {
            paging: {},
            current: {}
        };

    record.paging.hasNext = function () {
        return DataService.records.length > record.index + 1;
    };

    record.paging.hasPrevious = function () {
        return record.index > 0;
    };

    record.paging.next = function () {
        if (record.paging.hasNext()) {
            record.goTo(++record.index);
        }
        return record.index;
    };

    record.paging.previous = function () {
        if (record.paging.hasPrevious()) {
            record.goTo(--record.index);
        }
    };

    record.get = function (id) {
        var deferred = $q.defer();
        $http({
            method: 'GET',
            url: _baseUrl + '/api/records/' + String(id)
        }).then(function (response) {
            deferred.resolve(response.data);
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };

    record.goTo = function (index) {
        if (index !== undefined) {
            record.index = index;
        }

        record.current = DataService.records[index];

        $location.path('/app/data/record').search({'id': record.current.id});
    };

    return record;
}]);
;
app.factory('DataService', ['mappings', '$http', '$rootScope', '$q', '$timeout', 'log', 'User', '$window', function (mappings, $http, $rootScope, $q, $timeout, log, User, $window) {
    var _baseUrl = 'https://api.croplands.org',
        data = {
            records: [],
            count: {},
            columns: angular.copy(mappings),
            ordering: {},
            paging: {
                page: 1,
                page_size: 200
            },
            busy: false,
            bounds: false,
            ndviLimits: false,
            is_initialized: false
        }, canceler = $q.defer();


    function select(choices, value) {
        _.each(choices, function (option) {
            option.selected = value;
        });
    }

    function csvToJSON(csv, types) {
        var lines = csv.split("\n"),
            headers = lines[0].split(','),
            results;

        results = _.map(lines.slice(1, lines.length - 1), function (l) {
            var row = {};
            _.each(l.split(','), function (col, i) {
                var value = col;
                if (types && types[headers[i]]) {
                    value = types[headers[i]](col);
                }

                row[headers[i]] = value;
            });
            return row;
        });
        return results;
    }

    data.getParams = function () {
        var filters = {};
        _.each(data.columns, function (column, key) {
            var values = [];
            _.each(column.choices, function (option) {
                if (option.selected) {
                    values.push(option.id);
                }
            });
            filters[key] = values;
        });

        if (data.bounds) {
            filters.southWestBounds = data.bounds.southWest.lat + ',' + data.bounds.southWest.lng;
            filters.northEastBounds = data.bounds.northEast.lat + ',' + data.bounds.northEast.lng;
        }

        if (data.ndviLimits) {
            filters.ndvi_limit_upper = data.ndviLimits.upper.join(",");
            filters.ndvi_limit_lower = data.ndviLimits.lower.join(",");
        }

        return _.assign(filters, data.ordering, data.paging);
    };

    data.setDefault = function () {
        select(data.columns.land_use_type.choices, false);
        select(data.columns.crop_primary.choices, false);
        select(data.columns.water.choices, false);
        select(data.columns.intensity.choices, false);
        select(data.columns.year.choices, false);
        select(data.columns.source_type.choices, false);
    };

    data.reset = function () {
        log.info("[DataService] Reset");
        data.setDefault();
    };

    // load data from server
    data.load = function () {
        log.info("[DataService] Load");
        var deferred = $q.defer();
        data.busy = true;
        data.is_initialized = true;

        canceler.resolve();
        canceler = $q.defer();

        $http({
            url: _baseUrl + '/data/search',
            method: "GET",
            params: data.getParams(),
            timeout: canceler.promise
        }).then(function (response) {
            data.records = csvToJSON(response.data, {
                id: parseInt,
                month: parseInt,
                year: parseInt,
                lat: parseFloat,
                lon: parseFloat,
                crop_primary: parseInt,
                crop_secondary: parseInt,
                water: parseInt,
                intensity: parseInt,
                land_use_type: parseInt
            });

            var headers = response.headers();
            data.count.total = headers['query-count-total'];
            data.count.filtered = headers['query-count-filtered'];
            deferred.resolve(response);
            $rootScope.$broadcast("DataService.load", data.records);
            data.busy = false;
        }, function (e) {
            deferred.reject(e);
        });

        return deferred.promise;
    };

    data.download = function () {
        var deferred = $q.defer(),
            params = data.getParams();
        params.page_size = 100000;
        log.info("[DataService] Download");
        $http({
            url: _baseUrl + '/data/link',
            method: "GET",
            params: params
        }).then(function (response) {
            $window.open(_baseUrl + '/data/download' + '?token=' + response.data.token);
            console.log(response.data);
            deferred.resolve(response.data);
        }, function () {
            deferred.reject();
            log.info("[DataService] Download Failure at Link");
        });

        return deferred.promise;
    };

    data.init = function () {
        log.info("[DataService] Init");
        if (!data.is_initialized) {
            data.setDefault();
            data.load();
            data.is_initialized = true;
        }
    };

    return data;
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
app.factory('User', [ '$http', '$window', '$q', 'log','$rootScope','$location', function ($http, $window, $q, log, $rootScope, $location) {
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

//        log.debug('[UserService] getRole() : ' + role);

        return role;
    }

    function loadFromToken(token) {
        _user = JSON.parse($window.atob(token.split(".")[1]));
        _user.token = token;
        $window.localStorage.user = JSON.stringify(_user);
        // save token for future requests
        $http.defaults.headers.common.authorization = 'bearer ' + _user.token;
    }

    function isLoggedIn() {
        if (_user.expires && _user.token) {
            var secondsToExpiration = _user.expires - Math.floor(new Date().getTime() / 1000);
            return secondsToExpiration > 300;
        }

        return false;
    }

    function goNext() {
        var next;
        try {
            next = JSON.parse(window.atob(decodeURIComponent($location.search().n)));
            $location.path(next.path).search(next.params);
        }
        catch (e) {
            $window.location.href = "/";
        }
    }

    function changePassword(token, password) {
        var deferred = $q.defer();
        $http.post("https://api.croplands.org/auth/reset", {
            token: token,
            password: password
        }).then(function () {
            deferred.resolve(true);
        }, function () {
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

        $http.post(_baseUrl + "/auth/forgot", data, headers).then(function (r) {
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

        $http.post(_baseUrl + "/auth/reset", data, headers).then(function (r) {
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

        delete $http.defaults.headers.common.authorization;
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
        angular.element($window).on('storage', function () {
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
        get: getUser,
        goNext:goNext
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
    ]);
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

        // check values
        if (distance <= 10 || bearing === -1) {
            return [latlon.lat, latlon.lng];
        }

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
                },
                ndvi_landsat_7_2014: {
                    layerOptions: {
                        opacity: 1,
                        minZoom: 0,
                        maxNativeZoom: 15,
                        zIndex: 0
                    },
                    visible: false,
                    name: 'NDVI Landsat 7 2014 Composite',
                    type: 'xyz',
                    url: 'http://tiles.croplands.org/ndvi_landsat_7_2014/{x}/{y}/{z}'
                }
            },
            overlays: {
                gfsad1000v00: wmsLayers.gfsad1000v00,
                gfsad1000v10: wmsLayers.gfsad1000v10,
                us250v201512y2008: wmsLayers.us250v201512y2008,
                africaL4250v201512y2014: wmsLayers.africaL4250v201512y2014,
                egypt30mv201512y2014: wmsLayers.egypt30mv201512y2014,
                southamerica30v201512: wmsLayers.southamerica30v201512,
                southAsia250v201601y2010: wmsLayers.southAsia250v201601y2010,
                australia: wmsLayers.australiaACCA250m
            }
        }
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
app.factory('mappings', [function () {
    var data = {
        land_use_type: {'label': 'Land Use Type',
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
        },
        crop_primary: {'label': 'Crop Type',
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
                {'id': 22, 'label': 'Fallow', 'description': ''},
                {'id': 23, 'label': 'Tef', 'description': ''},
                {'id': 24, 'label': 'Pasture', 'description': 'May be managed'},
                {'id': 25, 'label': 'Oats', 'description': ''}
            ]
        },
        lat: {
            'label': 'Latitude'
        },
        lon: {
            'label': 'Longitude'
        },
        source_type: {
            'label': 'Source of Data',
            choices: [
                {'id': 'ground', 'label': 'Ground'},
                {'id': 'unknown', 'label': 'Unknown'},
                {'id': 'derived', 'label': 'Derived'}
            ]
        },
        user_validation: {'label': 'Validation Only',
            'style': 'success',
            'choices': [
                {'id': 0, 'label': 'Training', 'description': 'Data is used for training.'},
                {'id': 1, 'label': 'Validation', 'description': 'Data is used for validation.'}
            ]
        },
        year: {
            label: "Year",
            choices: []
        }
    };
    data.crop_secondary = angular.copy(data.crop_primary);


    var currentYear = new Date().getFullYear();
    for (var i = 2000; i < currentYear + 1; i++) {
        data.year.choices.push({label: i, id: i});
    }

    return data;
}]);;
app.factory('wmsLayers', ['$interval', 'leafletData', 'log', function ($interval, leafletData, log) {
    var _layers, WMSCollection;
    WMSCollection = function (obj, defaultLayer, defaultStyle) {
        this.playSpeed = 2000;
        _.extend(this, obj);

        if (this.layers) {
            this.idx = defaultLayer === undefined ? 0 : defaultLayer;
            console.log(this.idx);
            this.layerOptions.layers = this.layers[this.idx].layer;
            this.layerOptions.layerLabel = this.layers[this.idx].label;
        }

        if (this.styles) {
            var style, styles;

            if (defaultStyle) {
                style = this.styles[defaultStyle];
            } else {
                styles = _.values(this.styles);
                style = styles[styles.length - 1];
            }

            this.legend = style.legend;
            this.layerOptions.styles = style.id;
        }
    };

    WMSCollection.prototype.hasLayers = function () {
        return this.layers && this.layers.length > 1;
    };

    WMSCollection.prototype.hasStyles = function () {
        return this.styles && _.values(this.styles).length;
    };

    WMSCollection.prototype.changeImage = function (idx) {
        var currentWMSLayer = angular.copy(this.layerOptions.layers);

        this.layerOptions.layers = this.layers[idx].layer;
        this.layerOptions.layerLabel = this.layers[idx].label;

        this.redraw(currentWMSLayer);
    };

    WMSCollection.prototype.changeStyle = function (id) {
        var styleData;
        console.log(id);
        if (this.styles && this.styles[id]) {
            styleData = this.styles[id];
            this.layerOptions.styles = styleData.id;
        } else {
            log.error("[WMS] No style available.");
            return;
        }

        if (styleData.legend) {
            this.legend = styleData.legend;
        }

        this.redraw(this.layerOptions.layers);
    };

    /**
     * Set the wms parameters using leaflet functionality.
     * @param currentWMSLayer - needed to identify layer to redraw
     */
    WMSCollection.prototype.redraw = function (currentWMSLayer) {
        var currentLayer = this;
        console.log(currentLayer.layerOptions);
        leafletData.getMap().then(function (map) {
            map.eachLayer(function (layer) {
                if (layer.url === currentLayer._url && layer.options.layers === currentWMSLayer) {
                    var newParams = _.extend(layer.options, currentLayer.layerOptions);
                    layer.setParams(newParams);
                }
            });
        });
    };

    WMSCollection.prototype.next = function () {
        if (!this.hasLayers()) {
            return;
        }
        if (this.idx === this.layers.length - 1) {
            this.idx = 0;
        } else {
            this.idx++;
        }
        this.changeImage(this.idx);
    };

    WMSCollection.prototype.previous = function () {
        if (!this.hasLayers) {
            return;
        }
        if (this.idx === 0) {
            this.idx = this.layers.length - 1;
        } else {
            this.idx--;
        }
        this.changeImage(this.idx);
    };

    WMSCollection.prototype.play = function () {
        if (!this.hasLayers) {
            return;
        }

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

    WMSCollection.prototype.stop = function () {
        $interval.cancel(this.loop);
        delete this.loop;
    };

    _layers = {
        australiaACCA250m: new WMSCollection({
            id: 'australiaACCA250m',
            name: 'Australia GCE 250m Cropland Products 2000 to Present from ACCA ',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(-9.83464522447101, 110.000125), L.latLng(-45.00754522447101, 158.961625)),
                layers: 'Products:GCE 1km Crop Dominance year2000',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1
            },
            layers: [
                {layer: 'Products:Australia ACCA 250m v201512 year2000', label: '2000'},
                {layer: 'Products:Australia ACCA 250m v201512 year2001', label: '2001'},
                {layer: 'Products:Australia ACCA 250m v201512 year2002', label: '2002'},
                {layer: 'Products:Australia ACCA 250m v201512 year2003', label: '2003'},
                {layer: 'Products:Australia ACCA 250m v201512 year2004', label: '2004'},
                {layer: 'Products:Australia ACCA 250m v201512 year2005', label: '2005'},
                {layer: 'Products:Australia ACCA 250m v201512 year2006', label: '2006'},
                {layer: 'Products:Australia ACCA 250m v201512 year2007', label: '2007'},
                {layer: 'Products:Australia ACCA 250m v201512 year2008', label: '2008'},
                {layer: 'Products:Australia ACCA 250m v201512 year2009', label: '2009'},
                {layer: 'Products:Australia ACCA 250m v201512 year2010', label: '2010'},
                {layer: 'Products:Australia ACCA 250m v201512 year2011', label: '2011'},
                {layer: 'Products:Australia ACCA 250m v201512 year2012', label: '2012'},
                {layer: 'Products:Australia ACCA 250m v201512 year2013', label: '2013'},
                {layer: 'Products:Australia ACCA 250m v201512 year2014', label: '2014'}
            ],
            legend: [
                {label: '1 Croplands, rainfed, SC (Season 1 & 2), all crops', color: '#FFFF00'},
                {label: '2 Croplands, rainfed,SC, pastures', color: '#66FFFF'},
                {label: '3 Croplands, irrigated, SC, DC (Season 1 & 2), all crops', color: '#FF66FF'},
                {label: '4 Croplands, irrigated, SC, pastures', color: '#00B0F0'},
                {label: '5 Croplands, irrigated, continuous, orchards ', color: '#00B050'},
                {label: '6 Croplands,  fallow ', color: '#FBD4B4'}
            ]
        }),
        gfsad1000v00: {
            name: 'Global GCE 1km Cropland Dominance and Other Products',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                layers: 'Products:GCE 1km Crop Dominance year2000',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1
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
            name: 'Global GCE 1km Multi-study Cropland Mask Product',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                layers: 'Products:GCE 1km Crop Mask year2000',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1
            },
            attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: 'Croplands, Irrigation major', color: '#FF00FF'},
                {label: 'Croplands, Irrigation minor', color: '#00FF00'},
                {label: 'Croplands, Rainfed', color: '#FFFF00'},
                {label: 'Croplands, Rainfed minor fragments', color: '#00FFFF'},
                {label: 'Croplands, Rainfed very minor fragments', color: '#D2B58C'}

            ]
        },
        us250v201512y2008: {
            name: 'United States GCE 250m Croplands 2008 from ACCA',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                layers: 'Products:United States ACCA 250m v201512 year2008',
                minZoom: 0,
                maxZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                bounds: L.latLngBounds(L.latLng(49.4043, -124.5835), L.latLng(24.5025008881642, -66.8524020590759))
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: 'Corn-Soybean', color: '#FFFF00'},
                {label: 'Wheat-Barley', color: '#FF0000'},
                {label: 'Potato', color: '#663300'},
                {label: 'Alfalfa', color: '#00FF00'},
                {label: 'Cotton', color: '#00FFFF'},
                {label: 'Rice', color: '#0000FF'},
                {label: 'Other Crops', color: '#FF6600'}
            ]
        },
        southAsia250v201601y2010: {
            name: 'South Asia 250m Croplands 2010-2011 from ACCA',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                layers: 'Products:south_asia_250m',
                minZoom: 0,
                maxZoom: 16,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                bounds: L.latLngBounds(L.latLng(37.0985, 60.895), L.latLng(6.006, 97.416))
            },
            legend: [
                {label: "Unclassified", color: "#000000"},
                {label: "Irrigated-SW/GW-DC-rice-wheat", color: "#006400"},
                {label: "Irrigated-SW/GW-DC-rice-rice", color: "#00ff00"},
                {label: "Irrgated-SW-DC-beans/cotton-wheat", color: "#a0c27c"},
                {label: "Irrigated-SW-DC-Sugarcane/rice-rice/Plantations", color: "#7e9e65"},
                {label: "Irrigated-DC-fallows/pulses-rice-fallow", color: "#c5e5a4"},
                {label: "Irrigated-GW-DC-rice-maize/chickpea", color: "#7fffd4"},
                {label: "Irrgated-TC-rice-mixedcrops-mixedcrops", color: "#40e0d0"},
                {label: "Irrigated-GW-DC-millet/sorghum/potato-wheat/mustartd", color: "#cfe09c"},
                {label: "Irrigated-SW-DC-cotton/chilli/maize-fallow/pulses", color: "#00ffff"},
                {label: "Rainfed-DC-rice-fallows-jute/rice/mixed crops", color: "#ffff00"},
                {label: "Rainfed-SC-rice-fallow/pulses", color: "#ffd700"},
                {label: "Rainfed-DC-millets-chickpea/Fallows", color: "#cdad00"},
                {label: "Rainfed-SC-cotton/pigeonpea/mixedcrops", color: "#8b6913"},
                {label: "Rainfed-SC-groundnut/millets/sorghum", color: "#cd853f"},
                {label: "Rainfed-SC-pigeonpea/mixedcrops", color: "#ee9a49"},
                {label: "Rainfed-SC-millet-fallows/mixedcrops-", color: "#d8a585"},
                {label: "Rainfed-SC-fallow-chickpea-", color: "#e6bc8a"},
                {label: "Rainfed-SC-millets/fallows-LS", color: "#e0cab4"},
                {label: "Rainfed-SC-mixedcrops/Plantations", color: "#bd5e4d"},
                {label: "Shrublands/trees/Rainfed-mixedcrops30%", color: "#a020f0"},
                {label: "Other LULC", color: "#c0c0c0"}
            ]
        },
        africaL4250v201512y2014: new WMSCollection({
            name: 'Africa GCE 250m Cropland Products 2014 from ACCA',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(37.3494, -25.3695), L.latLng(-34.83026000000001, 63.50536000000001)),
                layers: 'Products:Africa ACCA L4 250m v201512 year2014',
                minZoom: 0,
                maxZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            styles: {
                'Africa ACCA L1 Extent v201512': {
                    name: 'Mask',
                    id: 'Africa ACCA L1 Extent v201512',
                    legend: [
                        {label: 'Cropland', color: '#00FF00'}
                    ]
                },
                'Africa ACCA L2 Water v201512': {
                    name: 'Irrigated',
                    id: 'Africa ACCA L2 Water v201512',
                    legend: [
                        {label: 'Irrigated', color: '#aec7e8'},
                        {label: 'Rainfed', color: '#9467bd'}
                    ]
                },
                'Africa ACCA L3 Intensity v201512': {
                    name: 'Intensity',
                    id: 'Africa ACCA L3 Intensity v201512',
                    legend: [
                        {label: "Single", color: "#aec7e8"},
                        {label: "Double", color: "#ffbb78"},
                        {label: "Continuous", color: "#98df8a"}
                    ]
                }//,
//                'Africa ACCA L4 Dominance v201512': {
//                    name: 'Dominance',
//                    id: 'Africa ACCA L4 Dominance v201512',
//                    legend: [
//                        {label: "C; IR; sc; mc I/rice", color: "#aec7e8"},
//                        {label: "C; IR; sc; mc II/rice/sorghum", color: "#ff7f0e"},
//                        {label: "C; IR; dc; mc I/rice", color: "#ffbb78"},
//                        {label: "C; IR; dc; mc II/rice", color: "#2ca02c"},
//                        {label: "C; IR; cc; sugarcane/plantations/other crops", color: "#98df8a"},
//                        {label: "C; IR; cc; mc", color: "#d62728"},
//                        {label: "C; IR; fallow croplands", color: "#ff9896"},
//                        {label: "C; RF; sc; rice", color: "#9467bd"},
//                        {label: "C; RF; sc; maize/unknown", color: "#bcbd22"},
//                        {label: "C; RF; dc; maize/rice", color: "#8c564b"},
//                        {label: "C; RF; cc; plantation/unknown", color: "#c49c94"},
//                        {label: "C; RF; cc; sugarcane/plantation/unknown", color: "#e377c2"},
//                        {label: "C; IR; cc; mc", color: "#f7b6d2"},
//                        {label: "C; RF; fallow croplands", color: "#7f7f7f"},
//                        {label: "NC; IR; barren/built-up/rangelands", color: "#c7c7c7"},
//                        {label: "NC; RF; shrubs/rangelands/forest", color: "#c5b0d5"},
//                        {label: "NC; mixed", color: "#dbdb8d"}
//                    ]
//                }
            }
        }),
        southamerica30v201512: {
            name: 'South America GCE 30m Cropland Mask Product 2014',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                layers: 'Products:South America Extent 30m v201512',
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                bounds: L.latLngBounds(L.latLng(12.835778465638036, -81.95811941094321), L.latLng(-56.073447989999984, -31.449983235209473))
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: 'Cropland', color: '#00FF00'}
            ]
        },
        egypt30mv201512y2014: new WMSCollection({
            name: 'Egypt GCE 30m Cropland Products 2014',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(37.3494, 24.3695), L.latLng(21.9, 36)),
                layers: 'Products:Egypt Extent 30m v201512 year2014',
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            styles: {
                'Africa ACCA L1 Extent v201512': {
                    name: 'Mask',
                    id: 'Africa ACCA L1 Extent v201512',
                    legend: [
                        {label: 'Cropland', color: '#00FF00'}
                    ]
                },
                'Africa ACCA L2 Water v201512': {
                    name: 'Irrigated',
                    id: 'Africa ACCA L2 Water v201512',
                    legend: [
                        {label: 'Irrigated', color: '#aec7e8'},
                        {label: 'Rainfed', color: '#9467bd'}
                    ]
                }
            }
        })
    };

    return _layers;
}
]);;
app.filter('mappings', ['mappings', function (mappings) {
    return function (key, field) {
        key = key || 0;
        try {
            return mappings[field].choices[key].label;
        } catch(e) {
            return key;
        }
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
app.controller("DataController", ['$scope', '$http', 'mapService', 'leafletData', function ($scope, $http, mapService, leafletData) {
    var leafletMap;

    angular.extend($scope, {
        sumCropType: 0,
        center: mapService.center,
        layers: mapService.layers,
        geojson: {},
        sort: {
            column: 'properties.crop_type',
            reverse: true
        },
        sortColumn: function (column) {
            console.log(column);

            if ($scope.sort.column === column) {
                $scope.sort.reverse = !$scope.sort.reverse;
            } else {
                $scope.sort.column = column;
                $scope.sort.reverse = false;
            }

            console.log($scope.sort);
        },
        moveToCountry: function (bounds) {
            leafletMap.fitBounds(bounds.pad(0.2));
        },
        goalFillAmount: function () {
            return 896 * (0.1 + $scope.sumCropType / 500000);
        }
    });

    _.each($scope.layers.overlays, function (layer) {
        layer.visible = false;
    });


    function getColor(properties) {

        if (properties.cultivated_area_hectares === 0) {
            return 'black';
        }

        if (properties.crop_type === 0) {
            return 'red';
        }


        var color, ratio, scale, red, green, blue;

        ratio = properties.ratio*10;
        scale = Math.max(Math.min((ratio - 500) / 50000, 1), 0);

        red = Math.round(255 * scale);
        green = Math.round(255 * (1 - scale));

        blue = 0;

        color = '#'
            + ("00" + red.toString(16)).slice(-2)
            + ("00" + green.toString(16)).slice(-2)
            + ("00" + blue.toString(16)).slice(-2);
//        console.log('ratio', ratio, scale, color);
        return color;

    }

    $http.get('https://s3.amazonaws.com/gfsad30/public/json/reference_data_coverage.json').then(function (response) {
        _.each(response.data.features, function (feature) {
            $scope.sumCropType += feature.properties.crop_type;
            feature.properties.cultivated_area_km2 = parseInt(feature.properties.cultivated_area_hectares / 100, 10);
            feature.properties.ratio = feature.properties.cultivated_area_km2 / feature.properties.crop_type;
            feature.properties.visible = true;
        });

        $scope.countries = response.data.features;

        leafletData.getMap().then(function (map) {
            leafletMap = map;

            L.geoJson(response.data.features, {
                style: function (feature) {
                    return {
                        weight: 2,
                        opacity: 0.8,
                        fillColor: getColor(feature.properties),
                        color: 'white',
                        dashArray: '3',
                        fillOpacity: 0.6
                    };
                },
                onEachFeature: function (feature, layer) {
                    feature.properties.bounds = layer.getBounds();
                }
            }).addTo(map);
        });
    }, function (err) {
        console.log(err);
    });

    $scope.$watch('center', function () {
        if (leafletMap === undefined) {
            return;
        }

        var currentMapBounds = leafletMap.getBounds().pad(0.50);

        _.each($scope.countries, function (country) {
            country.properties.visible = currentMapBounds.contains(country.properties.bounds);
        });
    });



}]);;
app.controller("DataRecordController", ['$scope', 'mapService', 'leafletData', '$location', 'DataRecord', '$q', 'geoHelperService', function ($scope, mapService, leafletData, $location, DataRecord, $q, geoHelperService) {
    var gridImageURL = "/static/imgs/icons/grid.png",
        shapes = {};

    angular.extend($scope, {
        id: $location.search().id,
        paging: {
            hasNext: DataRecord.paging.hasNext,
            hasPrevious: DataRecord.paging.hasPrevious,
            next: DataRecord.paging.next,
            previous: DataRecord.paging.previous
        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        layers: angular.copy(mapService.layers),
        markers: {},
        events: {
            map: {
                enable: [],
                logic: 'emit'
            }
        }
    });

    _.each($scope.layers.overlays, function (layer) {
        layer.visible = false;
    });

    function buildShapes() {
        var bearingDistance = 0,
            bearingSpread = 7.5,
            record = $scope.record,
            latlng = {
                lat: record.location.lat,
                lng: record.location.lon
            },
            originalLatlng = {
                lat: record.location.original_lat,
                lng: record.location.original_lon
            };

        leafletData.getMap('recordMap').then(function (map) {
            _.forOwn(shapes, function (shape) {
                map.removeLayer(shape);
            });
            shapes = {};            var circle250 = L.circle(latlng, 125);
            shapes.locationAreaGrid = L.imageOverlay(gridImageURL, circle250.getBounds());

            shapes.locationMarker = L.marker(latlng, {
                zIndexOffset: 1000,
                draggable: false
            });

//            shapes.locationMarker.on('dragend', function (event) {
//                log.info('[Location] Dragged marker: ' + event.distance + ' meters');
//                scope.buildGrid(shapes.locationMarker.getLatLng());
//                latLng = shapes.locationMarker.getLatLng();
//                scope.location.lat = latLng.lat;
//                scope.location.lon = latLng.lng;
//            });

            if (record.location.distance !== undefined) {
                bearingDistance = record.location.distance / 1000;
            }

            if (record.location.bearing) {
                shapes.polygon = L.polygon([
                    originalLatlng,
                    geoHelperService.destination(originalLatlng, record.location.bearing - bearingSpread, bearingDistance),
                    geoHelperService.destination(originalLatlng, record.location.bearing + bearingSpread, bearingDistance)
                ], {
                    color: '#00FF00',
                    stroke: false
                });
            }
            _.forOwn(shapes, function (shape) {
                shape.addTo(map);
            });

        }, function (e) {
            console.log(e);
        });
    }

    $scope.imageURL = function (url) {
        return "https://images.croplands.org/" + url.replace("images/", "");
    };

    DataRecord.get($scope.id).then(function (record) {
        $scope.record = record;
//        $scope.history = _.map(record.history, function (state) {
//            state = angular.fromJson(state);
//            state.date_edited = new Date(state.date_edited);
//            state.data = angular.fromJson(state.data);
//            return state;
//        });
        $scope.center.lat = record.location.lat;
        $scope.center.lng = record.location.lon;
        $scope.center.zoom = 17;
        buildShapes();
    }, function (e) {
        console.log(e);
    });
}]);;
app.controller("DataSearchController", ['$scope', '$http', 'mapService', 'leafletData', '$location', 'DataService', 'DataRecord', 'leafletData', function ($scope, $http, mapService, leafletData, $location, DataService, DataRecord, leafletData) {

    angular.extend($scope, {
        tableColumns: [
            {
                id: 'id',
                label: 'ID',
                visible: true
            },
            {
                id: 'land_use_type',
                label: 'Land Use Type',
                visible: true

            },
            {
                id: 'crop_primary',
                label: 'Primary Crop',
                visible: true
            },
            {
                id: 'water',
                label: 'Irrigation',
                visible: true
            },
            {
                id: 'intensity',
                label: 'Intensity',
                visible: true
            },
            {
                id: 'year',
                label: 'Year',
                visible: true
            },
            {
                id: 'country',
                label: 'Country',
                visible: true
            },
            {
                id: 'source_type',
                label: 'Source',
                visible: true
            }
        ],
        ordering: DataService.ordering,
        busy: true,
        bounds: {
            southWest: {
                lat: -90,
                lng: -180
            },
            northEast: {
                lat: 90,
                lng: 180
            }

        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        searchInMap: false,
        layers: angular.copy(mapService.layers),
        markers: {},
        events: {
            map: {
                enable: [],
                logic: 'emit'
            }
        }
    });

    _.each($scope.layers.overlays, function (layer) {
        layer.visible = false;
    });

    $scope.layers.overlays.markers = {
        name: 'markers',
        visible: true,
        type: 'group'
    };

    ////////// Helpers //////////
    function init() {
        if (DataService.is_initialized) {
            $scope.records = DataService.records;
            $scope.markers = buildMarkers($scope.records);
            $scope.ndvi = getNDVI(DataService.getParams());
            $scope.busy = false;
            $scope.count = DataService.count;
            $scope.percentage = $scope.count.filtered / $scope.count.total * 100;
        } else {
            applyParams($location.search());
            DataService.load();
        }

        if (DataService.bounds) {
            $scope.bounds = DataService.bounds;
            leafletData.getMap('searchMap').then(function (map) {
                map.fitBounds([
                    [$scope.bounds.southWest.lat, $scope.bounds.southWest.lng],
                    [$scope.bounds.northEast.lat, $scope.bounds.northEast.lng]
                ]);
                $scope.searchInMap = true;
            });
        }
    }

    function getData() {
        $scope.busy = true;
        $scope.$evalAsync(DataService.load);
    }

    function applyBounds(bounds) {
        if (DataService.bounds !== bounds) {
            DataService.bounds = bounds;
            getData();
        }
    }

    function buildMarkers(rows) {
        var records = {};

        _.each(rows, function (row) {
            records["m_" + row.id.toString()] = {
                lat: parseFloat(row.lat),
                lng: parseFloat(row.lon),
                layer: 'markers',
//                properties: row

            };
        });
        return records;
    }

    function getNDVI(params) {
        var url = 'https://api.croplands.org/data/image?';
        _.each(params, function (val, key) {
            if (key === 'southWestBounds' || key === 'northEastBounds' || key === 'ndvi_limit_upper' || key === 'ndvi_limit_lower') {
                return;
            }
            if (val.length) {
                _.each(val, function (v) {
                    url += key + "=" + v.toString() + "&";
                });
            }
        });

        if (params.southWestBounds && params.northEastBounds) {
            url += "southWestBounds=" + params.southWestBounds + "&";
            url += "northEastBounds=" + params.northEastBounds + "&";
        }
        if (params.ndvi_limit_upper && params.ndvi_limit_lower) {
            url += "ndvi_limit_upper=" + params.ndvi_limit_upper + "&";
            url += "ndvi_limit_lower=" + params.ndvi_limit_lower + "&";
        }
        return url;
    }

    function applyParams(params) {
        console.log(params);
        _.each(params, function (val, key) {
            if (DataService.columns[key] && key !== 'year' && key !== 'source_type') {
                if (Array.isArray(val)) {
                    _.each(val, function (idx) {
                        DataService.columns[key].choices[parseInt(idx, 10)].selected = true;
                    });
                } else {
                    DataService.columns[key].choices[parseInt(val, 10)].selected = true;
                }
            } else if (key === 'source_type') {
                var mappings = {};

                _.each(DataService.columns.source_type.choices, function (v, i) {
                    mappings[v.id] = i;
                });

                if (Array.isArray(val)) {
                    _.each(val, function (type) {
                        DataService.columns.source_type.choices[mappings[type]].selected = true;
                    });
                } else {
                    DataService.columns.source_type.choices[mappings[val]].selected = true;
                }
            }
            else if (key === 'year') {
                if (Array.isArray(val)) {
                    _.each(val, function (year) {
                        DataService.columns.year.choices[parseInt(year, 10) - 2000].selected = true;
                    });
                } else {
                    DataService.columns.year.choices[parseInt(val, 10) - 2000].selected = true;
                }
            } else if (key === 'southWestBounds') {
                var boundsSouthWest = val.split(',');
                DataService.bounds = {
                    southWest: {},
                    northEast: {}
                };
                DataService.bounds.southWest.lat = boundsSouthWest[0];
                DataService.bounds.southWest.lng = boundsSouthWest[1];
            } else if (key === 'northEastBounds') {
                var boundsNorthEast = val.split(',');
                DataService.bounds.northEast.lat = boundsNorthEast[0];
                DataService.bounds.northEast.lng = boundsNorthEast[1];
            } else if (key === 'page') {
                DataService.paging.page = parseInt(val, 10);
            } else if (key === 'page_size') {
                DataService.paging.page_size = parseInt(val, 10);
            }
            else if (key === 'ndvi_limit_upper') {
                if (!DataService.ndviLimits) {
                    DataService.ndviLimits = {};
                }
                DataService.ndviLimits.upper = val.split(',');
            }
            else if (key === 'ndvi_limit_lower') {
                if (!DataService.ndviLimits) {
                    DataService.ndviLimits = {};
                }
                DataService.ndviLimits.lower = val.split(',');
            }
        });

        console.log(DataService.ndviLimits);
    }

    ////////// End Helpers //////////


    ////////// Methods //////////
    $scope.sortColumn = function (column) {
        if (column === DataService.ordering.order_by) {
            if (DataService.ordering.order_by_direction === 'asc') {
                DataService.ordering.order_by_direction = 'desc';
            } else {
                DataService.ordering.order_by_direction = 'asc';
            }
        } else {
            DataService.ordering.order_by_direction = 'asc';
            DataService.ordering.order_by = column;
        }

        getData();
    };

    $scope.download = DataService.download;
    $scope.goToRecord = DataRecord.goTo;

    $scope.reset = function() {
        DataService.reset();
        getData();
    };

    $scope.apply = getData;

    $scope.zoomExtent = function () {
        $scope.center.lat = 0;
        $scope.center.lng = 0;
        $scope.center.zoom = 2;
    };

//    $scope.enableTemporalBounds = function () {
//        var svg = angular.element('#temporalProfile').find('svg');
//        console.log(svg);
//
//    };
    ////////// End Methods //////////


    ////////// Events //////////
    $scope.$on("DataService.load", function () {
        $scope.records = DataService.records;
        console.log(DataService.getParams());
        $location.search(DataService.getParams());
        $scope.markers = buildMarkers($scope.records);
        $scope.$evalAsync(function () {
            $scope.busy = false;
        });

        $scope.ndvi = getNDVI(DataService.getParams());
        $scope.count = DataService.count;
        $scope.percentage = $scope.count.filtered / $scope.count.total * 100;
    });

    $scope.$watch('bounds', _.debounce(function () {
        if ($scope.searchInMap) {
            applyBounds($scope.bounds);
        }
    }, 800));

    $scope.$watch('searchInMap', function (val, prev) {
        if (val === prev) {
            return;
        }

        if (val) {
            applyBounds($scope.bounds);
        } else {
            applyBounds(false);
        }
    });

    ////////// End Events //////////

    ////////// Init //////////
    init();
    ////////// Init //////////

}]);;
app.controller("MapController", ['$scope', 'mapService', 'DataService', 'leafletData', '$timeout', '$window', '$location', 'mappings', 'log', function ($scope, mapService, DataService, leafletData, $timeout, $window, $location, mappings, log) {

    ///////////
    // Utils //
    ///////////

    function stopPropagation(e) {
        L.DomEvent.stopPropagation(e);
    }

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

///////////////////////
// Listen for Events //
///////////////////////

    $scope.$watch(function () {
        return mapService.center;
    }, function (center) {
        $scope.center = center;
    }, true);

    $scope.$watch('center', function (center) {
        $location.moveCenter(center.lat, center.lng, center.zoom);
    });

    $scope.$watch('busy', function () {
        if ($scope.busy) {
            $scope.busyDialogVisible = true;
        }
    });


///////////////////////
// Button Actions    //
///////////////////////


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


    $scope.print = function () {
        window.print();
    };


//////////
// Init //
//////////

    function init() {
//        requestFullscreen($("#map-app"));
        var defaults = {
            tableOfContentsVisible: true,
            showHelp: false,
            showDownloadModal: false,
            busy: false,
            busyDialogVisible: false,
            table: {
                visible: false
            },
            events: {
                map: {
                    enable: ['mousedown', 'mousemove', 'click'],
                    logic: 'emit'
                }
            },
            center: mapService.center,
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


        // Apply defaults
        angular.extend($scope, defaults);
    }

    init();

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
            User.goNext();

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
    User.goNext();
}]);;
app.controller("RegisterController", ['User', 'countries', '$scope', '$location', 'log', function (User, countries, $scope, $location, log) {

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
                User.goNext();

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
app.directive('filter', ['log', '$q', '$timeout', 'mappings', 'DataService', function (log, $q, $timeout, mappings, DataService) {
    return {
        restrict: 'EA',
        scope: {
        },
        link: function (scope) {
            angular.extend(scope, {
                    land_use_type: DataService.columns.land_use_type.choices,
                    crop_primary: DataService.columns.crop_primary.choices,
                    water: DataService.columns.water.choices,
                    intensity: DataService.columns.intensity.choices,
                    year: DataService.columns.year.choices,
                    source_type: DataService.columns.source_type.choices,
                    count: DataService.count
                }
            );

            // Scope Methods
            scope.reset = DataService.reset;

            scope.apply = function () {
                scope.$parent.busy = true;
                scope.$evalAsync(DataService.load);
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

            scope.$on("DataService.load", function (e) {
                scope.count = DataService.count;
            });

        },
        templateUrl: '/static/directives/filter.html'
    };
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
app.directive('legend', [function () {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        templateUrl: '/static/directives/legend.html'
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
app.directive('ndvi', ['$http', '$log', '$q',
    function () {
        return {
            restrict: 'E',
            scope: {
                pts: '=pts'
            },
            link: function (scope) {
                scope.$watch('pts', function () {
                    scope.points = _.map(scope.pts, function (v, i) {
                        var x = i * 52.17, y = 1000 - Math.max(3, Math.min(v, 1000));
                        return x.toString() + ',' + y.toString();
                    }).join(" ");
                });
            },
            templateUrl: '/static/directives/ndvi.html'
        };

    }
]);;
app.directive('pieChart', ['$http', '$log', '$q',
    function () {
        return {
            restrict: 'E',
            scope: {
                value: '=value'
            },
            link: function (scope, element, attributes) {
                var size = 100;
                scope.radius = size / 2;
                scope.background = '#cccccc';

                scope.$watch('value', function (value) {
                    value = parseFloat(value);
                    scope.invalid = isNaN(value);

                    if (scope.invalid) {
                        scope.d = '';
                        return;
                    }

                    value = Math.min(Math.max(value, 0), 100);

                    console.log('pie value', value);
                    if (value === 100) {
                        console.log('short circuit pie');
                        scope.background = '#237c28';
                        scope.d = '';
                        return;
                    }



                    //calculate x,y coordinates of the point on the circle to draw the arc to.
                    var x = Math.cos((2 * Math.PI) / (100 / value));
                    var y = Math.sin((2 * Math.PI) / (100 / value));

                    //should the arc go the long way round?
                    var longArc = (value <= 50) ? 0 : 1;

                    //d is a string that describes the path of the slice.
                    scope.d = "M" + scope.radius + "," + scope.radius + " L" + scope.radius + ", 0, A" + scope.radius + "," + scope.radius + " 0 " + longArc + ",1 " + (scope.radius + y * scope.radius) + "," + (scope.radius - x * scope.radius) + " z";

                });


            },
            templateUrl: '/static/directives/pieChart.html'
        };

    }
]);
;
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
                return (typeof scope.layer === 'WMSCollection' && (scope.layer.hasLayers() || scope.layer.hasStyles())) || scope.layer.legend;
            };

            scope.changeStyle = function () {
                scope.layer.changeStyle(scope.style.id);
            };
        }
    };
}
]);

;
app.directive('temporalBounds', ['DataService', function (DataService) {
    var bounds = {
        upper: [],
        lower: [],
        max: 0,
        min: 1000,
        init: false
    }, radius = 12;

    return {
        scope: {
        },
        link: function (scope, element, attributes) {
            var svg, activeBoundsInterval, activeBoundsSide, x, y, scale;


            var numIntervals = parseInt(attributes.intervals, 10);
            var intervalWidth = parseFloat(attributes.intervalWidth);
            scope.padding = 20;
            svg = element[0].viewportElement;
            scale = svg.clientWidth / svg.viewBox.baseVal.width;

            function initBounds() {
                if (!bounds.init) {

                    if (DataService.ndviLimits) {
                        for (var i = 0; i < numIntervals; i++) {
                            bounds.upper.push({x: i * intervalWidth + scope.padding, y: 1000 - DataService.ndviLimits.upper[i] + scope.padding, r: radius});
                            bounds.lower.push({x: i * intervalWidth + scope.padding, y: 1000 - DataService.ndviLimits.lower[i] + scope.padding, r: radius});
                        }
                    } else {
                        for (var i = 0; i < numIntervals; i++) {
                            bounds.upper.push({x: i * intervalWidth + scope.padding, y: bounds.max + scope.padding, r: radius});
                            bounds.lower.push({x: i * intervalWidth + scope.padding, y: bounds.min + scope.padding, r: radius});
                        }
                    }

                    bounds.init = true;
                }

                scope.bounds = bounds;
            }

            function limitBounds() {
                _.each(scope.bounds.upper, function (pt) {

                    if (!pt.adjusted || pt.y < bounds.max + scope.padding) {
                        pt.y = bounds.max + scope.padding;
                        pt.adjusted = false;
                    }

                });

                _.each(scope.bounds.lower, function (pt) {
                    if (!pt.adjusted || pt.y > bounds.min + scope.padding) {
                        pt.y = bounds.min + scope.padding;
                        pt.adjusted = false;
                    }
                });
            }

            function mouseMove(e) {
                if (e.stopPropagation) e.stopPropagation();
                if (e.preventDefault) e.preventDefault();

                if (activeBoundsInterval !== null) {
                    scope.bounds[activeBoundsSide][activeBoundsInterval].y = Math.min(Math.max((e.clientY - y) / scale, bounds.max + scope.padding), bounds.min + scope.padding);
                    scope.bounds[activeBoundsSide][activeBoundsInterval].adjusted = true;
                    scope.$apply();
                } else {
                    if (activeBoundsSide === 'max') {
                        scope.bounds.max = Math.min(Math.max((e.clientY - y) / scale, 0), 1000);
                    }
                    if (activeBoundsSide === 'min') {
                        scope.bounds.min = Math.max(Math.min((e.clientY - y) / scale, 1000), 0);
                    }
                    limitBounds();
                    scope.$apply();
                }
            }

            function mouseUp(e) {
                if (activeBoundsSide === 'max' || activeBoundsSide === 'min') {
                    limitBounds();
                }

                DataService.ndviLimits = {
                    upper: _.map(scope.bounds.upper, function (pt) {
                        return Math.round(1000 - pt.y) + scope.padding;
                    }),
                    lower: _.map(scope.bounds.lower, function (pt) {
                        return Math.round(1000 - pt.y) + scope.padding;
                    })
                };

                scope.$apply();

                activeBoundsInterval = null;
                activeBoundsSide = null;
                disableEvents();
            }


            function enableEvents() {
                angular.element(svg).on('mousemove', mouseMove);
                angular.element(svg).on('mouseup', mouseUp);
//                angular.element(svg).on('mouseout', disableEvents);
            }

            function disableEvents() {
                angular.element(svg).off('mousemove', mouseMove);
                angular.element(svg).off('mouseup', mouseUp);
//                angular.element(svg).off('mouseout', disableEvents);
            }

            scope.mouseDown = function (e, index, side) {
                if (e.stopPropagation) e.stopPropagation();
                activeBoundsInterval = index;
                activeBoundsSide = side;

                y = svg.getBoundingClientRect().top;

                enableEvents();
            };

            scope.mouseOver = function (e, index, side) {
                scope.bounds[side][index].r = radius * 2;
            };

            scope.mouseOut = function (e, index, side) {
                scope.bounds[side][index].r = radius;
            };


            scope.selectionPoints = function () {
                var upper = _.map(scope.bounds.upper, function (v) {
                    return v.x.toString() + ',' + v.y.toString();
                });
                var lower = _.map(scope.bounds.lower, function (v) {
                    return v.x.toString() + ',' + v.y.toString();
                });

                return _.concat(upper, lower.reverse()).join(" ");
            };


            initBounds();

        },
        templateUrl: '/static/directives/temporal-bounds.html'
    };
}]);;
app.directive('draggableBounds', ['$document', function ($document) {
    return {
        restrict: 'EA',
        scope: {
            x: '=x',
            y: '=y'
        },
        link: function (scope, element, attributes) {


            angular.extend(scope, {
                radius: 20
            });

            var circle = element[0].children[0];
            circle.attr('cx', scope.x);
            circle.attr('cy', scope.y);

            circle.removeAttr('ng-attr-cx');
            circle.removeAttr('ng-attr-cy');

            var startY, y = angular.copy(scope.y);

            function mouseMove(e){
                y +=  (e.pageY - startY)/4;
                circle.attr('cy', y);
                console.log(element);
            }

            function mouseUp(){
                $document.off('mousemove', mouseMove);
                $document.off('mouseup', mouseUp);
//                scope.y = y;
            }

//            scope.mouseDown = function (e) {
//                e.stopPropagation();
//                $document.on('mousemove', mouseMove);
//                $document.on('mouseup', mouseUp);
//                startY = e.pageY;
//            };

        },
        template: '<circle ng-mousedown="mouseDown($event)" ng-attr-cx="{{ x }}" ng-attr-cy="{{ y }}" ng-attr-r="{{ radius }}" fill="red" />'
    };
}]);