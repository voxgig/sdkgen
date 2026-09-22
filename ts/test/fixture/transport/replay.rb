require 'socket'
require 'timeout'
require_relative 'utility/fetcher'

%w[POST PATCH GET].each do |method|
  server = TCPServer.new('127.0.0.1', 0)
  seen = []
  worker = Thread.new do
    loop do
      socket = server.accept
      begin
        request = socket.gets
        break unless request
        headers = {}
        while (line = socket.gets) && line != "\r\n"
          key, value = line.split(':', 2)
          headers[key.downcase] = value.strip
        end
        body = socket.read(headers.fetch('content-length', '0').to_i)
        seen << [request, body]
        if seen.length > 1
          socket.write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
        end
      ensure
        socket.close
      end
    end
  end

  begin
    response, error = Timeout.timeout(10) do
      DemoUtilities::DefaultHttpFetch.call(
        "http://127.0.0.1:#{server.addr[1]}/charge",
        { 'method' => method, 'body' => '{"amount":100}' })
    end
    raise error unless error.nil?
    expected = method == 'GET' ? 2 : 1
    raise "#{method} sent #{seen.length} requests: #{seen.inspect}" unless seen.length == expected
    raise 'request body was not received' unless seen.all? { |row| row[1] == '{"amount":100}' }
    status = method == 'GET' ? 200 : 0
    raise "#{method}: #{response.inspect}" unless response['status'] == status
    puts "#{method}: #{seen.length} request(s)"
  ensure
    worker.kill
    worker.join
    server.close
    DemoUtilities::HTTP_POOL.each_value do |connections|
      connections.each { |http| DemoUtilities.http_discard(http) }
    end
    DemoUtilities::HTTP_POOL.clear
  end
end
