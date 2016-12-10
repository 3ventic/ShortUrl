var config = {
    // The base URL *including* trailing slash i.e. 'https://link.example.com/'
    base_url: '',
    
    // Port to run the server on
    port: 8000,
    
    // Secret required to list and create short links
    secret: '',
    
    // Include hostname in the shortened URL, i.e. https://link.example.com/3v.fi/Oogis
    includeHostInPath: false
};

module.exports = config;