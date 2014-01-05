# Teepot, a teeparty supervisor

## Installation

```
npm install -g forever
npm install teepot
cp teepot/config.js.example teepot-config.js
forever start teepot -c teepot-config.js
```

## Configuration


## Events

### Supervisor

* worker.start [child]: triggered when a worker is started. The channel is
  accessibable via child.channel.

* worker.stop [child, code]: triggered when a worker exits.

* idle: when all workers were stopped.

## API

### Workers

* `GET /channel`: list current worker pids per channel
* `GET /channel/:channel`: list current worker pids and tasks 
                           on the given channel

* `GET /worker/:id`: Show status of the given worker
* `POST /worker/start`: Start a worker to the given channel
* `POST /worker/stop`: Stop the worker with the given pid

### Tasks

* `GET /tasks/:id`: show task information

