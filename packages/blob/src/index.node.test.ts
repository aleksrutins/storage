import { type Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { list, head, del, put } from './index';

const BLOB_API_URL = 'https://blob.vercel-storage.com';
const BLOB_STORE_BASE_URL = 'https://storeId.public.blob.vercel-storage.com';

const mockedFileMeta = {
  url: `${BLOB_STORE_BASE_URL}/foo-id.txt`,
  size: 12345,
  uploadedAt: '2023-05-04T15:12:07.818Z',
  pathname: 'foo.txt',
  contentType: 'text/plain',
  contentDisposition: 'attachment; filename="foo.txt"',
};

describe('blob client', () => {
  let mockClient: Interceptable;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN =
      'vercel_blob_rw_12345fakeStoreId_30FakeRandomCharacters12345678';
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    mockClient = mockAgent.get(BLOB_API_URL);
    jest.resetAllMocks();
  });

  describe('head', () => {
    it('should return Blob metadata when calling `head()`', async () => {
      let path: string | null = null;
      let headers: Record<string, string> = {};
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(200, (req) => {
          path = req.path;
          headers = req.headers as Record<string, string>;
          return mockedFileMeta;
        });

      await expect(head(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).resolves
        .toMatchInlineSnapshot(`
              {
                "contentDisposition": "attachment; filename="foo.txt"",
                "contentType": "text/plain",
                "pathname": "foo.txt",
                "size": 12345,
                "uploadedAt": 2023-05-04T15:12:07.818Z,
                "url": "https://storeId.public.blob.vercel-storage.com/foo-id.txt",
              }
          `);
      expect(path).toEqual(
        '/?url=https%3A%2F%2FstoreId.public.blob.vercel-storage.com%2Ffoo-id.txt',
      );
      expect(headers.authorization).toEqual(
        'Bearer vercel_blob_rw_12345fakeStoreId_30FakeRandomCharacters12345678',
      );
    });

    it('should return null when calling `head()` with an url that does not exist', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(404, { error: { code: 'not_found', message: 'Not found' } });

      await expect(head(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error('Vercel Blob: The requested blob does not exist'),
      );
    });

    it('should throw when calling `head()` with an invalid token', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(403, { error: { code: 'forbidden' } });

      await expect(head(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error(
          'Vercel Blob: Access denied, please provide a valid token for this resource',
        ),
      );
    });

    it('should throw a generic error when the worker returns a 500 status code', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(500, 'Invalid token');

      await expect(head(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error(
          'Vercel Blob: Unknown error, please visit https://vercel.com/help',
        ),
      );
    });

    it('should throw when the token is not set', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = '';

      await expect(head(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error(
          'Vercel Blob: No token found. Either configure the `BLOB_READ_WRITE_TOKEN` environment variable, or pass a `token` option to your calls.',
        ),
      );
    });

    it('should throw when store is suspended', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(403, { error: { code: 'store_suspended' } });

      await expect(head(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error('Vercel Blob: This store has been suspended'),
      );
    });

    it('should throw when store does NOT exist', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(403, { error: { code: 'store_not_found' } });

      await expect(head(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error('Vercel Blob: This store does not exist'),
      );
    });
  });

  describe('del', () => {
    it('should return null when calling `del()` with a single file path', async () => {
      let path: string | null = null;
      let headers: Record<string, string> = {};
      let body = '';
      mockClient
        .intercept({
          path: () => true,
          method: 'POST',
        })
        .reply(200, (req) => {
          path = req.path;
          headers = req.headers as Record<string, string>;
          body = req.body as string;
          return [mockedFileMeta.url];
        });

      await expect(
        del(`${BLOB_STORE_BASE_URL}/foo-id.txt`),
      ).resolves.toBeUndefined();

      expect(path).toEqual('/delete');
      expect(headers.authorization).toEqual(
        'Bearer vercel_blob_rw_12345fakeStoreId_30FakeRandomCharacters12345678',
      );
      expect(body).toMatchInlineSnapshot(
        `"{"urls":["https://storeId.public.blob.vercel-storage.com/foo-id.txt"]}"`,
      );
    });

    it('should return null Blob metadata when calling `del()` with multiple file paths', async () => {
      let path: string | null = null;
      let headers: Record<string, string> = {};
      let body = '';
      mockClient
        .intercept({
          path: () => true,
          method: 'POST',
        })
        .reply(200, (req) => {
          path = req.path;
          headers = req.headers as Record<string, string>;
          body = req.body as string;
          return [mockedFileMeta.url, mockedFileMeta.url];
        });

      await expect(
        del([
          `${BLOB_STORE_BASE_URL}/foo-id1.txt`,
          `${BLOB_STORE_BASE_URL}/foo-id2.txt`,
        ]),
      ).resolves.toBeUndefined();
      expect(path).toEqual('/delete');
      expect(headers.authorization).toEqual(
        'Bearer vercel_blob_rw_12345fakeStoreId_30FakeRandomCharacters12345678',
      );
      expect(body).toMatchInlineSnapshot(
        `"{"urls":["https://storeId.public.blob.vercel-storage.com/foo-id1.txt","https://storeId.public.blob.vercel-storage.com/foo-id2.txt"]}"`,
      );
    });

    it('should throw when calling `del()` with an invalid token', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'POST',
        })
        .reply(403, { error: { code: 'forbidden' } });

      await expect(del(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error(
          'Vercel Blob: Access denied, please provide a valid token for this resource',
        ),
      );
    });

    it('should throw a generic error when the worker returns a 500 status code', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'POST',
        })
        .reply(500, 'Invalid token');

      await expect(del(`${BLOB_STORE_BASE_URL}/foo-id.txt`)).rejects.toThrow(
        new Error(
          'Vercel Blob: Unknown error, please visit https://vercel.com/help',
        ),
      );
    });
  });

  describe('list', () => {
    const mockedFileMetaList = {
      url: mockedFileMeta.url,
      pathname: mockedFileMeta.pathname,
      size: mockedFileMeta.size,
      uploadedAt: mockedFileMeta.uploadedAt,
    };

    it('should return a list of Blob metadata when calling `list()`', async () => {
      let path: string | null = null;
      let headers: Record<string, string> = {};
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(200, (req) => {
          path = req.path;
          headers = req.headers as Record<string, string>;
          return {
            blobs: [mockedFileMetaList, mockedFileMetaList],
            cursor: 'cursor-123',
            hasMore: true,
          };
        });

      await expect(
        list({ cursor: 'cursor-abc', limit: 10, prefix: 'test-prefix' }),
      ).resolves.toMatchInlineSnapshot(`
        {
          "blobs": [
            {
              "pathname": "foo.txt",
              "size": 12345,
              "uploadedAt": 2023-05-04T15:12:07.818Z,
              "url": "https://storeId.public.blob.vercel-storage.com/foo-id.txt",
            },
            {
              "pathname": "foo.txt",
              "size": 12345,
              "uploadedAt": 2023-05-04T15:12:07.818Z,
              "url": "https://storeId.public.blob.vercel-storage.com/foo-id.txt",
            },
          ],
          "cursor": "cursor-123",
          "hasMore": true,
        }
      `);
      expect(path).toBe('/?limit=10&prefix=test-prefix&cursor=cursor-abc');
      expect(headers.authorization).toEqual(
        'Bearer vercel_blob_rw_12345fakeStoreId_30FakeRandomCharacters12345678',
      );
    });

    it('should throw when calling `list()` with an invalid token', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(403, { error: { code: 'forbidden' } });

      await expect(list()).rejects.toThrow(
        new Error(
          'Vercel Blob: Access denied, please provide a valid token for this resource',
        ),
      );
    });

    it('should throw a generic error when the worker returns a 500 status code', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'GET',
        })
        .reply(500, 'Invalid token');
      await expect(list()).rejects.toThrow(
        new Error(
          'Vercel Blob: Unknown error, please visit https://vercel.com/help',
        ),
      );
    });
  });

  describe('put', () => {
    const mockedFileMetaPut = {
      url: mockedFileMeta.url,
      pathname: mockedFileMeta.pathname,
      contentType: mockedFileMeta.contentType,
      contentDisposition: mockedFileMeta.contentDisposition,
    };

    it('should upload a file with a custom token', async () => {
      let path: string | null = null;
      let headers: Record<string, string> = {};
      let body = '';
      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(200, (req) => {
          path = req.path;
          headers = req.headers as Record<string, string>;
          body = req.body as string;
          return mockedFileMetaPut;
        });

      await expect(
        put('foo.txt', 'Test Body', {
          access: 'public',
          token: 'NEW_TOKEN',
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          "contentDisposition": "attachment; filename="foo.txt"",
          "contentType": "text/plain",
          "pathname": "foo.txt",
          "url": "https://storeId.public.blob.vercel-storage.com/foo-id.txt",
        }
      `);
      expect(path).toBe('/foo.txt');
      expect(headers.authorization).toEqual('Bearer NEW_TOKEN');
      expect(body).toMatchInlineSnapshot(`"Test Body"`);
    });

    it('should upload a file with a custom content-type', async () => {
      let headers: Record<string, string> = {};

      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(200, (req) => {
          headers = req.headers as Record<string, string>;
          return mockedFileMetaPut;
        });

      await put('foo.txt', 'Test Body', {
        access: 'public',
        contentType: 'text/plain',
      });
      expect(headers['x-content-type']).toEqual('text/plain');
    });

    it('should throw when calling `put()` with an invalid token', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(403, { error: { code: 'forbidden' } });

      await expect(
        put('foo.txt', 'Test Body', {
          access: 'public',
          contentType: 'text/plain',
        }),
      ).rejects.toThrow(
        new Error(
          'Vercel Blob: Access denied, please provide a valid token for this resource',
        ),
      );
    });

    it('should throw a generic error when the worker returns a 500 status code', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(500, 'Generic Error');
      await expect(
        put('foo.txt', 'Test Body', {
          access: 'public',
          contentType: 'text/plain',
        }),
      ).rejects.toThrow(
        new Error(
          'Vercel Blob: Unknown error, please visit https://vercel.com/help',
        ),
      );
    });

    it('should fail when the filepath is missing', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(200, mockedFileMetaPut);

      await expect(
        put('', 'Test Body', {
          access: 'public',
        }),
      ).rejects.toThrow(new Error('Vercel Blob: pathname is required'));
    });

    it('should fail when the body is missing', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(200, mockedFileMetaPut);

      await expect(
        put('path.txt', '', {
          access: 'public',
        }),
      ).rejects.toThrow(new Error('Vercel Blob: body is required'));
    });

    it('should throw when uploading a private file', async () => {
      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(200, mockedFileMetaPut);

      await expect(
        put('foo.txt', 'Test Body', {
          // @ts-expect-error: access is only public for now, testing that a different value throws
          access: 'private',
        }),
      ).rejects.toThrow(new Error('Vercel Blob: access must be "public"'));
    });

    it('sets the correct header when using the addRandomSuffix option', async () => {
      let headers: Record<string, string> = {};

      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(200, (req) => {
          headers = req.headers as Record<string, string>;
          return mockedFileMetaPut;
        });

      await put('foo.txt', 'Test Body', {
        access: 'public',
        addRandomSuffix: false,
      });
      expect(headers['x-add-random-suffix']).toEqual('0');
    });

    it('sets the correct header when using the cacheControlMaxAge option', async () => {
      let headers: Record<string, string> = {};

      mockClient
        .intercept({
          path: () => true,
          method: 'PUT',
        })
        .reply(200, (req) => {
          headers = req.headers as Record<string, string>;
          return mockedFileMetaPut;
        });

      await put('foo.txt', 'Test Body', {
        access: 'public',
        cacheControlMaxAge: 60,
      });
      expect(headers['x-cache-control-max-age']).toEqual('60');
    });
  });
});
