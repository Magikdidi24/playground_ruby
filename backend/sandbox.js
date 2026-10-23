// "ruby:3.3.9-alpine" lines -> { "3.3.9-alpine": "ruby:3.3.9-alpine" }.
// Null prototype: "constructor" or "__proto__" must not look like a version.
function parseVersions(text) {
  const versions = Object.create(null);
  for (const line of text.split('\n')) {
    const image = line.trim();
    if (image) versions[image.split(':')[1]] = image;
  }
  return versions;
}

// Podman lists Docker Hub images fully qualified: "docker.io/library/ruby:3.3.9-alpine".
function hasImage(images, image) {
  return images.some(img => (img.RepoTags || []).some(tag => tag === image || tag === `docker.io/library/${image}`));
}

// With Tty off, Docker multiplexes stdout and stderr into frames:
// [stream id, 0, 0, 0, payload size (uint32 BE)] then the payload. Keep both, in order.
function decodeOutput(buffer) {
  const payloads = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset + 4);
    payloads.push(buffer.subarray(offset + 8, offset + 8 + size));
    offset += 8 + size;
  }
  return Buffer.concat(payloads).toString('utf-8');
}

// DNS rebinding guard: a page on evil.com that resolves to 127.0.0.1 still sends "Host: evil.com".
function isLocalHost(host) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host || '');
}

module.exports = { parseVersions, hasImage, decodeOutput, isLocalHost };
