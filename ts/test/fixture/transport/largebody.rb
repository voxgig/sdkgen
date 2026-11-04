require 'socket'
require 'timeout'
require 'zlib'
require 'json'
require_relative 'utility/fetcher'

# A list of about 17 MB, served whole, as two gzip members, and as raw deflate.
items = (0...28_000).map do |i|
  { 'id' => "item#{i}", 'name' => "Item #{i} ☃", 'tags' => %w[a b c], 'note' => 'x' * 500 }
end
list = JSON.generate(items)
half = list.bytesize / 2
raw = Zlib::Deflate.new(Zlib::DEFAULT_COMPRESSION, -Zlib::MAX_WBITS)
bodies = {
  'identity' => [list, nil],
  'gzip members' => [Zlib.gzip(list.byteslice(0, half)) + Zlib.gzip(list.byteslice(half..)), 'gzip'],
  'raw deflate' => [raw.deflate(list, Zlib::FINISH), 'deflate'],
}

bodies.each do |name, (body, encoding)|
  server = TCPServer.new('127.0.0.1', 0)
  worker = Thread.new do
    socket = server.accept
    nil while (line = socket.gets) && line != "\r\n"
    socket.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n" \
      "#{encoding ? "Content-Encoding: #{encoding}\r\n" : ''}" \
      "Content-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n")
    socket.write(body)
    socket.close
  end

  begin
    response, error = Timeout.timeout(60) do
      DemoUtilities::DefaultHttpFetch.call("http://127.0.0.1:#{server.addr[1]}/list", { 'method' => 'GET' })
    end
    raise "#{name}: #{error}" unless error.nil?
    raise "#{name}: body is not valid JSON" if response['unreadable']
    got = response['json'].call
    raise "#{name}: #{got.length} of #{items.length} items" unless got.length == items.length
    raise "#{name}: content-encoding kept" if response['headers'].key?('content-encoding')
    puts "#{name}: #{got.length} items from #{list.bytesize} bytes"
  ensure
    worker.join(5)
    worker.kill
    server.close
    DemoUtilities::HTTP_POOL.clear
  end
end
