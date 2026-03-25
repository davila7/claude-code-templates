# Full OAuth Server

> Build a self-contained authentication system where your FastMCP server manages users, issues tokens, and validates them.

> **Warning:** **This is an extremely advanced pattern that most users should avoid.** Building a secure OAuth 2.1 server requires deep expertise in authentication protocols, cryptography, and security best practices. The complexity extends far beyond initial implementation to include ongoing security monitoring, threat response, and compliance maintenance.

  **Use Remote OAuth instead** unless you have compelling requirements that external identity providers cannot meet, such as air-gapped environments or specialized compliance needs.


The Full OAuth Server pattern exists to support the MCP protocol specification's requirements. Your FastMCP server becomes both an Authorization Server and Resource Server, handling the complete authentication lifecycle from user login to token validation.

This documentation exists for completeness - the vast majority of applications should use external identity providers instead.

## OAuthProvider

FastMCP provides the `OAuthProvider` abstract class that implements the OAuth 2.1 specification. To use this pattern, you must subclass `OAuthProvider` and implement all required abstract methods.

> **Note:** `OAuthProvider` handles OAuth endpoints, protocol flows, and security requirements, but delegates all storage, user management, and business logic to your implementation of the abstract methods.


## Required Implementation

You must implement these abstract methods to create a functioning OAuth server:

### Client Management


  
    Retrieve client information by ID from your database.

    
      
        Client identifier to look up
      
    

    
      
        Client information object or `None` if client not found
      
    
  

  
    Store new client registration information in your database.

    
      
        Complete client registration information to store
      
    

    
      
        No return value
      
    
  


### Authorization Flow


  
    Handle authorization request and return redirect URL. Must implement user authentication and consent collection.

    
      
        OAuth client making the authorization request
      

      
        Authorization request parameters from the client
      
    

    
      
        Redirect URL to send the client to
      
    
  

  
    Load authorization code from storage by code string. Return `None` if code is invalid or expired.

    
      
        OAuth client attempting to use the authorization code
      

      
        Authorization code string to look up
      
    

    
      
        Authorization code object or `None` if not found
      
    
  


### Token Management


  
    Exchange authorization code for access and refresh tokens. Must validate code and create new tokens.

    
      
        OAuth client exchanging the authorization code
      

      
        Valid authorization code object to exchange
      
    

    
      
        New OAuth token containing access and refresh tokens
      
    
  

  
    Load refresh token from storage by token string. Return `None` if token is invalid or expired.

    
      
        OAuth client attempting to use the refresh token
      

      
        Refresh token string to look up
      
    

    
      
        Refresh token object or `None` if not found
      
    
  

  
    Exchange refresh token for new access/refresh token pair. Must validate scopes and token.

    
      
        OAuth client using the refresh token
      

      
        Valid refresh token object to exchange
      

      
        Requested scopes for the new access token
      
    

    
      
        New OAuth token with updated access and refresh tokens
      
    
  

  
    Load an access token by its token string.

    
      
        The access token to verify
      
    

    
      
        The access token object, or `None` if the token is invalid
      
    
  

  
    Revoke access or refresh token, marking it as invalid in storage.

    
      
        Token object to revoke and mark invalid
      
    

    
      
        No return value
      
    
  

  
    Verify bearer token for incoming requests. Return `AccessToken` if valid, `None` if invalid.

    
      
        Bearer token string from incoming request
      
    

    
      
        Access token object if valid, `None` if invalid or expired
      
    
  


Each method must handle storage, validation, security, and error cases according to the OAuth 2.1 specification. The implementation complexity is substantial and requires expertise in OAuth security considerations.

> **Warning:** **Security Notice:** OAuth server implementation involves numerous security considerations including PKCE, state parameters, redirect URI validation, token binding, replay attack prevention, and secure storage requirements. Mistakes can lead to serious security vulnerabilities.


> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.
