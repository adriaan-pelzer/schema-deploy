// Config file for aws-s3-deploy

// schema-deploy test path_to_folder_containing_json_schema_files
// - files have to have .json extension
// - filenames have to be version number (ex. 0.1.2.json)
// - files have to be in a folder named after the type (ex. /puff/0.0.1.json)

module.exports = {
    test: {
        google: {
            client_id: 'GOOGLE_CLIENT_ID',
            client_secret: 'GOOGLE_CLIENT_SECRET'
        },
        apiUrl: 'PARTICLE_API_BASE_URL_NO_TRAILING_SLASHES',
        omitRegex: [
            /LIST_OF_FILE_PATH_REGEXES_TO_OMIT/
        ]
    }
}
