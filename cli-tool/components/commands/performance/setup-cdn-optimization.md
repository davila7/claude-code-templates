---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [cdn-provider] | --cloudflare | --aws | --fastly
description: Configure CDN for optimal content delivery, caching, and global performance optimization
model: sonnet
---

# Setup CDN Optimization

Configure CDN for optimal delivery: **$ARGUMENTS**

## Instructions

1. **CDN Strategy and Provider Selection**
   - Analyze application traffic patterns and global user distribution
   - Evaluate CDN providers based on performance, cost, and features
   - Assess content types and specific caching requirements
   - Plan CDN architecture and edge location strategy
   - Define performance and cost optimization goals

2. **CDN Configuration and Setup**
   - Configure CDN with optimal settings for your content types
   - Set up origin servers and failover configurations
   - Configure SSL/TLS certificates and security settings
   - Implement custom domain and DNS configuration
   - Set up monitoring and analytics tracking

3. **Static Asset Optimization**
   - Optimize asset build process for CDN delivery
   - Configure content hashing and versioning strategies
   - Set up asset bundling and code splitting for CDN
   - Implement responsive image delivery and optimization
   - Configure font loading and optimization strategies

4. **Compression and Optimization**
   - Configure Gzip and Brotli compression settings
   - Set up build-time compression for static assets
   - Implement dynamic compression for API responses
   - Configure minification and asset optimization
   - Set up progressive image formats (WebP, AVIF)

5. **Cache Headers and Policies**
   - Design intelligent caching strategies for different content types
   - Configure cache control headers and TTL values
   - Implement ETags and conditional request handling
   - Set up cache hierarchy and multi-tier caching
   - Configure cache warming and preloading strategies

6. **Image Optimization and Delivery**
   - Implement responsive image delivery with multiple formats
   - Set up automatic image compression and optimization
   - Configure lazy loading and progressive image loading
   - Implement image resizing and format conversion
   - Set up WebP and AVIF format support with fallbacks

7. **CDN Purging and Cache Invalidation**
   - Implement intelligent cache invalidation strategies
   - Set up automated purging for deployment pipelines
   - Configure selective purging by tags or patterns
   - Implement real-time cache invalidation for dynamic content
   - Set up cache invalidation monitoring and alerts

8. **Performance Monitoring and Analytics**
   - Set up CDN performance monitoring and metrics tracking
   - Monitor cache hit ratios and bandwidth usage
   - Track response times and error rates across regions
   - Implement real user monitoring for CDN performance
   - Set up alerts for performance degradation

9. **Security and Access Control**
   - Configure CDN security headers and policies
   - Implement hotlink protection and referrer validation
   - Set up DDoS protection and rate limiting
   - Configure geo-blocking and access restrictions
   - Implement secure token authentication for protected content

10. **Cost Optimization and Monitoring**
    - Monitor CDN usage and costs across different tiers
    - Implement cost optimization strategies for bandwidth usage
    - Set up automated cost alerts and budget monitoring
    - Analyze usage patterns for tier optimization
    - Configure cost-effective caching policies

Focus on CDN optimizations that provide the most significant performance improvements for your specific content types and user base. Always measure CDN performance impact and adjust configurations based on real-world usage patterns.