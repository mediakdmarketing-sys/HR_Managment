// Loopback-only fake IMAP and SMTP servers. They record everything a client sends
// (decrypted, when TLS is used) and reject every login with a reply that echoes the
// submitted credentials back, which lets tests prove that credentials are scrubbed from
// errors. No external host is contacted.
//
// Options: { tls: { key, cert } } enables TLS; for IMAP it is direct TLS, for SMTP it is
// offered via STARTTLS. Without it the servers are plaintext and never offer STARTTLS.
import net from "node:net";
import tls from "node:tls";

const createRecordingServer = ({ greeting, handleLine, tlsOptions = null, directTls = false }) => {
  // record.logins lists each credential-bearing command with whether it arrived over TLS.
  const record = { connections: 0, received: "", logins: [] };
  const sockets = new Set();

  const onConnection = (initialSocket) => {
    record.connections += 1;
    const state = { secure: directTls };
    let socket = initialSocket;
    let buffer = "";
    const track = (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
      s.on("error", () => {});
    };
    const onData = (chunk) => {
      const text = chunk.toString("utf8");
      record.received += text;
      buffer += text;
      let index;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        handleLine(line, connection, state);
      }
    };
    const connection = {
      write: (text) => socket.write(text),
      end: () => socket.end(),
      // Upgrades the plaintext socket to TLS (STARTTLS).
      startTls: () => {
        socket.removeListener("data", onData);
        buffer = "";
        const secureSocket = new tls.TLSSocket(socket, { isServer: true, ...tlsOptions });
        track(secureSocket);
        secureSocket.on("data", onData);
        socket = secureSocket;
        state.secure = true;
      },
      canStartTls: Boolean(tlsOptions) && !directTls,
      recordLogin: (line) => record.logins.push({ line, overTls: state.secure }),
    };
    track(socket);
    socket.on("data", onData);
    socket.write(greeting);
  };

  const server = directTls ? tls.createServer(tlsOptions, onConnection) : net.createServer(onConnection);
  return {
    record,
    async start(host) {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        // "::" with ipv6Only=false accepts both ::1 and 127.0.0.1, so "localhost" lands here.
        server.listen({ host, port: 0, ipv6Only: false }, resolve);
      });
      this.port = server.address().port;
      return this;
    },
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
};

export const createFakeImapServer = ({ tls: tlsOptions = null } = {}) =>
  createRecordingServer({
    greeting: "* OK fake IMAP ready\r\n",
    tlsOptions,
    directTls: Boolean(tlsOptions),
    handleLine: (line, connection) => {
      const [tag, rawCommand = ""] = line.split(" ");
      const command = rawCommand.toUpperCase();
      if (command === "CAPABILITY") {
        connection.write(`* CAPABILITY IMAP4rev1\r\n${tag} OK CAPABILITY completed\r\n`);
      } else if (command === "STARTTLS") {
        connection.write(`${tag} BAD STARTTLS not supported\r\n`);
      } else if (command === "LOGIN" || command === "AUTHENTICATE") {
        connection.recordLogin(line);
        connection.write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials, received: ${line}\r\n`);
      } else if (command === "LOGOUT") {
        connection.write(`* BYE logging out\r\n${tag} OK LOGOUT completed\r\n`);
        connection.end();
      } else if (tag) {
        connection.write(`${tag} OK done\r\n`);
      }
    },
  });

export const createFakeSmtpServer = ({ tls: tlsOptions = null } = {}) =>
  createRecordingServer({
    greeting: "220 fake.local ESMTP ready\r\n",
    tlsOptions,
    directTls: false,
    handleLine: (line, connection, state) => {
      const decode = (text) => Buffer.from(text, "base64").toString("utf8").replace(/\u0000/g, " ");
      if (state.awaiting === "user") {
        state.user = line;
        state.awaiting = "pass";
        connection.write("334 UGFzc3dvcmQ6\r\n");
        return;
      }
      if (state.awaiting === "pass") {
        state.awaiting = null;
        connection.recordLogin(line);
        connection.write(`535 5.7.8 Rejected login ${state.user} ${line} (${decode(state.user)} / ${decode(line)})\r\n`);
        return;
      }
      const upper = line.toUpperCase();
      if (upper.startsWith("EHLO")) {
        const offerTls = connection.canStartTls && !state.secure;
        connection.write(`250-fake.local\r\n${offerTls ? "250-STARTTLS\r\n" : ""}250 AUTH PLAIN LOGIN\r\n`);
      } else if (upper === "STARTTLS" && connection.canStartTls && !state.secure) {
        connection.write("220 Ready to start TLS\r\n");
        connection.startTls();
      } else if (upper.startsWith("AUTH PLAIN ")) {
        connection.recordLogin(line);
        const payload = line.slice("AUTH PLAIN ".length);
        connection.write(`535 5.7.8 Rejected login ${payload} (${decode(payload)})\r\n`);
      } else if (upper === "AUTH LOGIN") {
        state.awaiting = "user";
        connection.write("334 VXNlcm5hbWU6\r\n");
      } else if (upper.startsWith("QUIT")) {
        connection.write("221 bye\r\n");
        connection.end();
      } else {
        connection.write("250 OK\r\n");
      }
    },
  });
