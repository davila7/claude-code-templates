const ReferenceValidator = require('../../src/validation/validators/ReferenceValidator');

describe('ReferenceValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ReferenceValidator();
  });

  describe('Safe Content', () => {
    it('should pass validation for content with HTTPS URLs', async () => {
      const component = {
        content: `Check out [this guide](https://example.com/guide) for more info.

Visit https://docs.example.com for documentation.`,
        path: 'safe.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should pass for content without URLs', async () => {
      const component = {
        content: 'This is plain text without any URLs.',
        path: 'plain.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
    });
  });

  describe('URL Extraction', () => {
    it('should extract markdown links', () => {
      const content = '[Example](https://example.com) and [Another](https://test.com)';
      const urls = validator.extractUrls(content);

      expect(urls).toHaveLength(2);
      expect(urls[0].url).toBe('https://example.com');
      expect(urls[1].url).toBe('https://test.com');
    });

    it('should extract plain URLs', () => {
      const content = 'Visit https://example.com and https://test.com for more.';
      const urls = validator.extractUrls(content);

      expect(urls.length).toBeGreaterThanOrEqual(2);
      expect(urls.some(u => u.url === 'https://example.com')).toBe(true);
    });

    it('should not duplicate URLs from markdown and plain text', () => {
      const content = '[Link](https://example.com) and also https://example.com';
      const urls = validator.extractUrls(content);

      const exampleUrls = urls.filter(u => u.url === 'https://example.com');
      expect(exampleUrls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Protocol Validation', () => {
    it('should error on file:// protocol', async () => {
      const component = {
        content: '[Local file](file:///etc/passwd)',
        path: 'dangerous.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'REF_E002'
        })
      );
    });

    it('should error on javascript: protocol', async () => {
      const component = {
        content: '[XSS](javascript:alert("XSS"))',
        path: 'dangerous.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'REF_E005'
        })
      );
    });

    it('should error on data: protocol', async () => {
      const component = {
        content: 'https://example.com and also data:text/html,<script>alert("XSS")</script>',
        path: 'dangerous.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'REF_E002'
        })
      );
    });

    it('should warn on HTTP (non-strict mode)', async () => {
      const component = {
        content: '[Link](http://example.com)',
        path: 'http-link.md'
      };

      const result = await validator.validate(component, { strictHttps: false });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'REF_W002'
        })
      );
    });

    it('should error on HTTP (strict mode)', async () => {
      const component = {
        content: '[Link](http://example.com)',
        path: 'http-link.md'
      };

      const result = await validator.validate(component, { strictHttps: true });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'REF_E003'
        })
      );
    });
  });

  describe('Private IP Detection', () => {
    it('should detect loopback addresses', async () => {
      const component = {
        content: '[Local](http://127.0.0.1:8080)',
        path: 'dangerous.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'REF_E004'
        })
      );
    });

    it('should detect Class A private IPs', async () => {
      const component = {
        content: '[Private](https://10.0.0.1)',
        path: 'dangerous.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'REF_E004'
        })
      );
    });

    it('should detect Class B private IPs', async () => {
      const component = {
        content: '[Private](https://172.16.0.1)',
        path: 'dangerous.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
    });

    it('should detect Class C private IPs', async () => {
      const component = {
        content: '[Private](https://192.168.1.1)',
        path: 'dangerous.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
    });

    it('should warn about localhost references', async () => {
      const component = {
        content: '[Local](http://localhost:3000)',
        path: 'local.md'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'REF_W003'
        })
      );
    });
  });

  describe('Suspicious TLD Detection', () => {
    it('should warn about .tk domains', async () => {
      const component = {
        content: '[Link](https://example.tk)',
        path: 'suspicious.md'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'REF_W004'
        })
      );
    });

    it('should warn about .zip domains', async () => {
      const component = {
        content: '[File](https://download.zip)',
        path: 'suspicious.md'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'REF_W004'
        })
      );
    });
  });

  describe('Image Validation', () => {
    it('should validate image URLs', async () => {
      const component = {
        content: '![Logo](https://example.com/logo.png)',
        path: 'image.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
    });

    it('should warn about large data URIs', async () => {
      const largeDataUri = 'data:image/png;base64,' + 'A'.repeat(15000);
      const component = {
        content: `![Image](${largeDataUri})`,
        path: 'image.md'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'REF_W006'
        })
      );
    });

    it('should allow small data URIs', async () => {
      const smallDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const component = {
        content: `![Pixel](${smallDataUri})`,
        path: 'image.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    it('should correctly identify private IPs', () => {
      expect(validator.isPrivateIp('10.0.0.1')).toBe(true);
      expect(validator.isPrivateIp('172.16.0.1')).toBe(true);
      expect(validator.isPrivateIp('192.168.1.1')).toBe(true);
      expect(validator.isPrivateIp('8.8.8.8')).toBe(false);
    });

    it('should correctly identify localhost', () => {
      expect(validator.isLocalhost('localhost')).toBe(true);
      expect(validator.isLocalhost('127.0.0.1')).toBe(true);
      expect(validator.isLocalhost('::1')).toBe(true);
      expect(validator.isLocalhost('example.com')).toBe(false);
    });

    it('should correctly identify suspicious TLDs', () => {
      expect(validator.isSuspiciousTld('example.tk')).toBe(true);
      expect(validator.isSuspiciousTld('download.zip')).toBe(true);
      expect(validator.isSuspiciousTld('example.com')).toBe(false);
    });
  });

  describe('Reference Report Generation', () => {
    it('should generate comprehensive reference report', async () => {
      const component = {
        content: `
[HTTPS Link](https://example.com)
[HTTP Link](http://test.com)
Visit https://docs.example.com
        `,
        path: 'test.md'
      };

      const report = await validator.generateReferenceReport(component);

      expect(report).toHaveProperty('safe');
      expect(report).toHaveProperty('totalUrls');
      expect(report).toHaveProperty('httpsCount');
      expect(report).toHaveProperty('httpCount');
      expect(report).toHaveProperty('httpsPercentage');
      expect(report.totalUrls).toBeGreaterThan(0);
    });

    it('should calculate HTTPS percentage correctly', async () => {
      const component = {
        content: `
[Link1](https://example.com)
[Link2](https://test.com)
[Link3](http://old.com)
        `,
        path: 'test.md'
      };

      const report = await validator.generateReferenceReport(component);

      expect(report.httpsCount).toBe(2);
      expect(report.httpCount).toBe(1);
      expect(parseFloat(report.httpsPercentage)).toBeCloseTo(66.7, 0);
    });
  });

  describe('Invalid URLs', () => {
    it('should warn about malformed URLs', async () => {
      const component = {
        content: '[Bad Link](htp://malformed)',
        path: 'invalid.md'
      };

      const result = await validator.validate(component);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'REF_W005'
        })
      );
    });
  });

  describe('Markdown Link Attacks', () => {
    it('should detect javascript in markdown links', async () => {
      const component = {
        content: '[Click me](javascript:void(0))',
        path: 'attack.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'REF_E005'
        })
      );
    });

    it('should detect vbscript in markdown links', async () => {
      const component = {
        content: '[Click me](vbscript:msgbox("XSS"))',
        path: 'attack.md'
      };

      const result = await validator.validate(component);

      expect(result.valid).toBe(false);
    });
  });
});
