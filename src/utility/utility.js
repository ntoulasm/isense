const utility = {};

utility.javaScriptDocumentScheme = {
    language: 'javascript',
    scheme: 'file'
};

utility.isJavaScriptDocument = function(document) {
    return document.languageId == "javascript";
};

module.exports = utility;