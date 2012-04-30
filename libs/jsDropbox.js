/*                                                                            *
 *  jsDropbox v1.0                                                            *
 *  A javascript API to access dropbox                                        *
 *  https://github.com/perfectayush/jsDropbox 
 *  Copyright Ayush Goyal 2012                                                *
 *                                                                            *
 *  Uses the Javascript OAuth library by Rob Griffiths aka bytespider         *
 *  https://github.com/bytespider/jsOAuth                                     *
 *                                                                            *
 *  Also uses OAuthSimple Javascript library                                  *
 *  http://unitedheroes.net/OAuthSimple/                                      *
 *                                                                            *
 *  Licensed under the Mozilla Public License, Version 2.0 (the "License");   *
 *  you may not use this file except in compliance with the License.          *
 *  You may obtain a copy of the License at                                   *
 *                                                                            *
 *     http://www.mozilla.org/MPL/2.0/                                        *
 *                                                                            *
 *  Unless required by applicable law or agreed to in writing, software       *
 *  distributed under the License is distributed on an "AS IS" BASIS,         *
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  *
 *  See the License for the specific language governing permissions and       *
 *  limitations under the License.                                            */

/**
 * @namespace For handling all Dropbox API methods
 */
var dropbox = {};

/**Dropbox API Consumer Key (required/Change to your consumer key!!!) */
dropbox.consumerKey = "";
/**Dropbox API Consumer Secret Key (required/Change to your consumer secret key!!!) */
dropbox.consumerSecret = "";

/**
 * Expiry time for dropbox Oauth access token in milliseconds
 * Note:Set for 29 days
 */
dropbox.accessTokenExpiry = 2505600000;

/**
 *Dropbox accesstype
 *Set to "dropbox" if your application has been given full Dropbox folder access
 *Set to "sandbox" if your application has been given "AppFolder" folder access
 */
dropbox.accessType = "sandbox";

/**
 *Dropbox html5 storage key for storing access token
 *(Change to a suitable value!!!)
 */
dropbox.htmlAccessStorageKey = "myApp";


/**
 *  function to setup dropbox.oauth object
 *  @param {string} userEmail Login Email Address
 *  @param {string} userPass Login Password
 *  @param {function} success Success Callback Function
 *  @param {function} failure Failure Callback Function
 */
dropbox.setupoauth = function(userEmail, userPass, success, failure) {
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    var requestURL = "https://api.dropbox.com/1/oauth/request_token";
    var authorizeURL = "https://www.dropbox.com/1/oauth/authorize";
    var accessURL = "https://api.dropbox.com/1/oauth/access_token";
    var loginURL = "https://www.dropbox.com/login";

    var config = {
        requestTokenUrl : requestURL,
        authorizationUrl : authorizeURL,
        accessTokenUrl : accessURL,
        consumerKey : dropbox.consumerKey,
        consumerSecret : dropbox.consumerSecret,
    };

    var loginData = {
        login_email : userEmail,
        login_password : userPass,
        login_submit : "Log in",
    };
    oauth = OAuth(config);
    try {
        oauth.fetchRequestToken(function(url) {

            //Split OAuth requestToken for later use
            var requestTokenTemp = url.split('?');
            requestTokenTemp = requestTokenTemp[1].split('&');
            var requestTokenSecret = requestTokenTemp[0].split('=');
            requestTokenSecret = requestTokenSecret[1];
            var requestToken = requestTokenTemp[1].split('=');
            requestToken = requestToken[1];

            var accessData = {
                oauth_token : requestToken,
                oauth_token_secret : requestTokenSecret
            };

            // for testing
            console.log(requestToken + " " + requestTokenSecret);

            //Login in dropbox
            oauth.post(loginURL, loginData, function(data) {
                
                //Get Authorize Token From Server
                oauth.get(url,function(data){
                    
                    console.log(data);
                    
                    //Extract Authorize Token From Page
                    textString = data.text;
                    pos = textString.search("TOKEN");
                    relevent = textString.slice(pos,pos+40);
                    pos2 = relevent.search(",");
                    relevent = relevent.slice(0,pos2);
                    releventArray = relevent.split("'");
                    authorizeToken = releventArray[1]
                    
                    //Authorization POST Data
                    allowData = {allow_access : "Continue",
                                 oauth_token:requestToken,
                                 t : authorizeToken
                    }
                    oauth.post(url, allowData, function(data) {

                        //Get Access Token
                        oauth.post(accessURL, accessData, function(data) {

                            //Split OAuth AcessToken for later use
                            var accessTokenTemp = data["text"].split("&");
                            var accessTokenSecret = accessTokenTemp[0].split('=');
                            accessTokenSecret = accessTokenSecret[1];
                            var accessToken = accessTokenTemp[1].split('=');
                            accessToken = accessToken[1];

                            oauth.setAccessToken(accessToken, accessTokenSecret);
                            
                            //stores OAuth access Token in html5 storage with timestamp 
                            var dateValue = new Date();
                            dateValue = dateValue.getTime();
                            var accessTokenString = accessToken + '&' + accessTokenSecret + '&' + dateValue;
                            window.localStorage.setItem(dropbox.htmlAccessStorageKey, accessTokenString);

                            //setup OAuth object
                            dropbox.oauth = oauth;

                            //run the success function
                            if( typeof (success) == "function")
                                success();
                        }, failure);
                    }, failure);
                }, failure);
            },failure);
        }, failure);
    } catch(error) {
        var errorObject = {};
        errorObject.text = '{"error":"Connection Could not be established","Exception":"' + error + '"}'
        failure();
    }

}


/**
 *  Removes OAuth access token key from html5 storage 
 *  Note: You may need to delete dropbox login cookie from cache
 */
dropbox.logout = function() {
    //may need to add logout logic to remove dropbox login cookies
    window.localStorage.removeItem(dropbox.htmlAccessStorageKey);
    dropbox.oauth = {};
}


/**
 * Function to setup dropbox.oauth object from html5 storage
 * If the token has expired it automatically deletes it and returns false else it returns true
 * If returns False use dropbox.setupoauth
 * Note: You may need to delete dropbox login cookie from cache in case this returns false
 * @returns {boolean} Wheather or not setting up dropbox.oauth object was successfull
 */
dropbox.setupHtml5Oauth = function() {
    var accessDetails = window.localStorage.getItem(dropbox.htmlAccessStorageKey);
    if(accessDetails) {
        accessDetails = accessDetails.split('&');
        var config = {
            consumerKey : dropbox.consumerKey,
            consumerSecret : dropbox.consumerSecret,
        };

        var dateValue = new Date();
        dateValue = dateValue.getTime();
        accessDetails[2] = parseInt(accessDetails[2]);
        if(dateValue - accessDetails[2] < dropbox.accessTokenExpiry) {
            var oauth = OAuth(config);
            oauth.setAccessToken(accessDetails[0], accessDetails[1]);
            dropbox.oauth = oauth;
            return true;
        } else {
            dropbox.logout();
            return false;
        }
    } else
        return false;
}




/**
 * To get metadata about folder/file from dropbox
 * @param {string} path Specify location of folder from root(optional)
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.getMetadata = function(path, success, failure) {
    path = ( typeof (path) == 'undefined') ? null : path;
    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    var metaURL = "https://api.dropbox.com/1/metadata/" + dropbox.accessType + "/";
    if(path) {
        metaURL = metaURL + path;
    }

    dropbox.oauth.getJSON(metaURL, success, failure);
}
/**
 * To get dropbox AccountInfo
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.getAccountInfo = function(success,failure) {
    
    var accountInfoURL = "https://api.dropbox.com/1/account/info";
    
    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    dropbox.oauth.getJSON(accountInfoURL, function(data) {
        success(data)
    }, failure);

}

/**
 * Get contents of a file from dropbox in data object (not download)
 * @param {string} path Relative path of file from root
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.getFile = function(path, success, failure) {
    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    var getURL = "https://api-content.dropbox.com/1/files/" + dropbox.accessType + "/";
    if(path) {
        getURL = getURL + path;
    }
    dropbox.oauth.get(getURL, success, failure);

}

/**
 * Returns download URL of a file from dropbox (Non-Sharable)
 * @param {string} path Relative path of file from root
 * @return {string}
 */
dropbox.downloadFile = function(path) {
    var getURL = "https://api-content.dropbox.com/1/files/" + dropbox.accessType + "/";
    if(path) {
        getURL = getURL + path;
    }
    var downloadURL = dropbox.signedUrl(getURL, "");
    console.log(downloadURL);
    return downloadURL;
}

/**
 * Upload a file
 * @param {string} path Relative path of file from root
 * @param {fileObj} fileObj FileObject of file to be uploaded
 * @param {boolean} overwrite To overwrite a file or not (not working)
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.uploadFile = function(path, fileObj, overwrite, success, failure) {
    //path of folder to upload file
    path = ( typeof (path) == 'undefined') ? null : path;

    //upload URL
    var uploadURL = "https://api-content.dropbox.com/1/files_put/" + dropbox.accessType + "/";
    if(path != null && path != "") {
        uploadURL = uploadURL + path + '/' + fileObj.name;
    } else {
        uploadURL = uploadURL + fileObj.name;
    }
    success = ( typeof (success) == "function") ? success : dropbox.log;
    failure = ( typeof (success) == "function") ? failure : dropbox.log;

    var options = {
        method : 'PUT',
        url : uploadURL,
        success : success,
        failure : failure,
        headers : {
            "Content-Type" : fileObj.mimeType,
            "Content-length" : fileObj.length,
            "overwrite" : overwrite
        },
        data : fileObj.string
    };
    dropbox.oauth.request(options);

}


/**
 * Delete a file/folder
 * @param {string} path Relative path of file/folder to be deleted from root
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.deletePath = function(path, success, failure) {

    path = ( typeof (path) == 'undefined') ? null : path;

    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    //delete URL
    var deleteURL = "https://api.dropbox.com/1/fileops/delete";

    if(path != null && path != "") {

        var options = {
            method : 'POST',
            url : deleteURL,
            success : success,
            failure : failure,
            data : {
                "path" : path,
                "root" : dropbox.accessType
            }
        };
        dropbox.oauth.request(options);
    }
}


/**
 * Copy a file/folder
 * @param {string} fromPath Relative path of file/folder to be copied from root
 * @param {string} toPath Relative path to where file/folder will be copied from root
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.copyPath = function(fromPath,toPath, success, failure) {

    fromPath = ( typeof (fromPath) == 'undefined') ? null : fromPath;
    toPath = ( typeof (toPath) == 'undefined') ? null : toPath;

    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    //copy URL
    var copyURL = "https://api.dropbox.com/1/fileops/copy";

    if(fromPath != null && fromPath != "" && toPath != null && toPath != "" ) {

        var options = {
            method : 'POST',
            url : copyURL,
            success : success,
            failure : failure,
            data : {
                "from_path" : fromPath,
                "to_path" : toPath,
                "root" : dropbox.accessType
            }
        };
        dropbox.oauth.request(options);
    }
}


/**
 * Create a folder
 * @param {string} path Relative path of folder to be created from root
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.createFolder = function(path, success, failure) {
    //path of folder to be created
    path = ( typeof (path) == 'undefined') ? null : path;
 
    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    //create folder URL
    var createFolderURL = "https://api.dropbox.com/1/fileops/create_folder";

    if(path != null && path != "") {

        var options = {
            method : 'POST',
            url : createFolderURL,
            success : success,
            failure : failure,
            data : {
                "path" : path,
                "root" : dropbox.accessType
            }
        };
        dropbox.oauth.request(options);
    }
}



/**
 * Move a file/folder
 * @param {string} fromPath Relative path of file/folder to be moved from root
 * @param {string} toPath Relative path to where file/folder will be moved to  (including file/folder name),from root
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.movePath = function(fromPath,toPath, success, failure) {

    fromPath = ( typeof (fromPath) == 'undefined') ? null : fromPath;
    toPath = ( typeof (toPath) == 'undefined') ? null : toPath;

    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    //move URL
    var moveURL = "https://api.dropbox.com/1/fileops/move";

    if(fromPath != null && fromPath != "" && toPath != null && toPath != "" ) {

        var options = {
            method : 'POST',
            url : moveURL,
            success : success,
            failure : failure,
            data : {
                "from_path" : fromPath,
                "to_path" : toPath,
                "root" : dropbox.accessType
            }
        };
        dropbox.oauth.request(options);
    }
}


/**
 * Share a file/folder (Generates 30 day expiry link)
 * @param {string} path Relative path of file from root
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.sharePath = function(path, success, failure) {
    path = ( typeof (path) == 'undefined') ? null : path;
    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    var shareURL = "https://api.dropbox.com/1/shares/" + dropbox.accessType + "/";
    if(path!=null && path!="") {
        shareURL = shareURL + path;
        dropbox.oauth.post(shareURL, success, failure);
    }
}



/**
 * Stream a file/folder (4 hour Expiry Link)
 * @param {string} path Relative path of file/folder from root
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.streamPath = function(path, success, failure) {
    path = ( typeof (path) == 'undefined') ? null : path;
    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    var streamURL = "https://api.dropbox.com/1/media/" + dropbox.accessType + "/";
    if(path!=null && path!="") {
        streamURL = streamURL + path;
        dropbox.oauth.post(streamURL, success, failure);
    }
}


/**
 * Search a file/folder at a given path
 * @param {string} path Relative path of file/folder to be searched from root
 * @param {string} query Query String for search
 * @param {function} success Success Callback Function
 * @param {function} failure Failure Callback Function
 */
dropbox.search = function(path,query, success, failure) {
    path = ( typeof (path) == 'undefined') ? null : path;
    query = ( typeof (query) == 'undefined') ? null : query;
    success = ( typeof (success) == 'function') ? success : dropbox.log;
    failure = ( typeof (failure) == 'function') ? failure : dropbox.log;

    //search URL
    var searchURL = "https://api.dropbox.com/1/search/" + dropbox.accessType + "/";

    if(path!=null && query!=null) {
        searchURL = searchURL + path;
        var options = {
            method : 'POST',
            url : searchURL,
            success : success,
            failure : failure,
            data : {
                "query" : query
            }
        };
        dropbox.oauth.request(options);
    }
}



/**
 *  General failure log
 */
dropbox.log = function(data) {
    console.log(data);
};


/**
 *  Get signed oauth url using OAuthSimple Library
 *  @param {string} url URL to be signed
 *  @param {string} argumentsAsString See OAuthSimple documentation
 *  @return {string}
 */
dropbox.signedUrl = function(url, argumentsAsString) {
    var accessTokenKey = dropbox.oauth.getAccessTokenKey();
    var accessTokenSecret = dropbox.oauth.getAccessTokenSecret();
    var resultUrl = (new OAuthSimple()).sign({
        path : url,
        parameters : argumentsAsString,
        signatures : {
            'consumer_key' : dropbox.consumerKey,
            'shared_secret' : dropbox.consumerSecret,
            'access_token' : accessTokenKey,
            'access_secret' : accessTokenSecret
        }
    });
    return resultUrl;
}



/**
 *  Make a fileObject to be used for upload file
 *  @param {string} name Name of File
 *  @param {string} content Content of File as String
 *  @param {number} length Length of File(Length of Content String)
 *  @param {string} mimeType MIMETYPE of file
 *  @return {object} A fileObj which is needed to upload a File 
 */
dropbox.file = function(name,content,length,mimeType) {
    
    var fileObj = {
        name    : name,
        string  : content,
        length  : length,
        mimeType: mimeType
    };
    
    return fileObj;
}
