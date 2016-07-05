var R = require ( 'ramda' );
var H = require ( 'highland' );
var I = require ( 'inspect-log' );
var fs = require ( 'fs' );
var recurs = require ( 'recursive-readdir' );
var request = require ( 'request' );
var crypto = require ( 'crypto' );

if ( process.argv.length < 4 ) {
    console.log ( 'Please specify an environment (prod|staging|test) and a path where the schemas can be found' );
    process.exit ( 1 );
}

var config = require ( './schemaConf.js' )[process.argv[2]];

if ( ! config ) {
    console.log ( 'Please specify an environment configured in schemaConf.js' );
    process.exit ( 1 );
}

var parseResponse = H.wrapCallback ( function ( response, callback ) {
    if ( response.statusCode !== 200 ) {
        return callback ( response.body );
    }

    try {
        return callback ( null, JSON.parse ( response.body ) );
    } catch ( error ) {
        return callback ( error.message );
    }
} );

var authenticateRequest = function ( req ) {
    var sep = ( req.url.indexOf ( '?' ) === -1 ) ? '?' : '&';

    return R.merge ( req, {
        url: [
            req.url,
            sep,
            'sig',
            '=',
            crypto.createHash ( 'sha256' ).update ( [
                config.google.client_secret,
                config.google.client_id,
                R.head ( R.split ( '?', req.url.replace ( config.apiUrl, '' ) ) ),
                R.toUpper ( req.method ),
                req.body
            ].join ( '' ) ).digest ( 'hex' )
        ].join ( '' )
    } );
};

H.wrapCallback ( recurs )( process.argv[3] )
    .sequence ()
    .filter ( R.compose ( R.equals ( 'json' ), R.last, R.split ( '.' ) ) )
    .filter ( function ( path ) {
        return R.reduce ( function ( filter, omitRegex ) {
            return filter && ! ( path.match ( omitRegex ) );
        }, true, config.omitRegex );
    } )
    .doto ( I )
    .flatMap ( function ( path ) {
        return H ( [ path ] )
            .flatMap ( H.wrapCallback ( function ( path, callback ) {
                fs.readFile ( path, callback );
            } ) )
            .map ( JSON.parse )
            .map ( function ( schema ) {
                return {
                    version: R.compose ( R.join ( '.' ), R.init, R.split ( '.' ), R.last, R.split ( '/' ) )( path ),
                    type: R.compose ( R.last, R.init, R.split ( '/' ) )( path ),
                    schema: schema
                };
            } )
            .filter ( function ( encSchema ) {
                return encSchema.version.match ( /\d\.\d\.\d/ ) && encSchema.type;
            } )
            .flatMap ( function ( encSchema ) {
                var url = config.apiUrl + '/particle-json-schemas?version=' + encSchema.version + '&type=' + encSchema.type;

                return H.wrapCallback ( request )( url )
                    .flatMap ( parseResponse )
                    .flatMap ( function ( oldSchemas ) {
                        if ( R.isEmpty ( oldSchemas ) ) {
                            return H.wrapCallback ( request )( authenticateRequest ( {
                                url: [ config.apiUrl, 'particle-json-schemas' ].join ( '/' ),
                                method: 'POST',
                                header: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify ( encSchema )
                            } ) );
                        }

                        return H.wrapCallback ( request )( authenticateRequest ( {
                            url: [ config.apiUrl, 'particle-json-schemas', oldSchemas[0].id ].join ( '/' ),
                            method: 'PUT',
                            header: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify ( encSchema )
                        } ) );
                    } )
                    .flatMap ( parseResponse );
            } );
    } )
    .errors ( R.unary ( console.error ) )
    .each ( I );
