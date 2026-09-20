# SIPp, in a container shaped like the NATS one: an image whose entrypoint IS
# the program, with the flags supplied as the command.
#
#   accessories:
#     nats:  image: nats:2.10-alpine   cmd: "-js -sd /data -m 8222"
#     sipp:  image: <this>             cmd: "-sn uas -p 5060 -nostdin"
#
# SEPARATE FROM THE PORTAL IMAGE, deliberately. This can place and answer SIP
# calls; the portal is a web app. Keeping them apart means the portal image
# cannot dial anything even if something goes wrong in it, and this one is
# rebuilt only when SIPp's version changes rather than on every deploy.
#
# THE LONG-RUNNING FORM OF SIPP IS A UAS — it waits to be called, and answers.
# That is what an accessory is: something that stays up and serves. Placing
# calls is a one-shot instead (`make sipp-uac`), so it is `run`, not a service.
#
# NO AGENT AND NO BROKER. A worker was written to accept run requests over
# NATS, and then deleted: SIPp's arguments already say everything a run needs,
# so anything that carries them is a second way to express the same thing. It
# would only be needed to start runs from a web page.

ARG DEBIAN_VERSION=trixie-20260610-slim
FROM docker.io/debian:${DEBIAN_VERSION}

# THE PROJECT'S OWN STATIC BINARY, not `apt-get install sip-tester`, and the
# reason is measured rather than stylistic: builds from this network get 403
# from deb.debian.org often enough to fail at a different random package each
# time, which is why the portal's own runner stage has no apt at all. A release
# asset is one file from one host, statically linked, so nothing needs
# installing beside it.
#
# Pinned. `latest` would mean the image quietly changes what it tests with.
ARG SIPP_VERSION=3.7.7
ADD --chmod=0755 https://github.com/SIPp/sipp/releases/download/v${SIPP_VERSION}/sipp /usr/local/bin/sipp

# Scenario XML beyond the ones SIPp carries itself (`-sn uac`, `-sn uas`, …),
# which need no files at all. Mounted when there are any.
RUN mkdir -p /scenarios && chown nobody /scenarios
WORKDIR /scenarios

# NOT root. SIPp needs no privilege for the high UDP ports used here. Media
# capture (pcap play, -rtp_echo) would want cap_net_raw, and that is a decision
# to make when media scenarios arrive, not a default.
USER nobody

ENTRYPOINT ["/usr/local/bin/sipp"]

# Answer calls and never exit: no `-m` limit, and `-nostdin` because there is
# no terminal in a container — without it SIPp reads the keyboard, gets EOF and
# exits at once, which reads as the call failing rather than as a missing flag.
CMD ["-sn", "uas", "-p", "5060", "-nostdin"]
