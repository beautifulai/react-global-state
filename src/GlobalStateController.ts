import * as React from "react";

import GlobalState from "./GlobalState";

class GlobalStateController<State> {
    protected _globalState: GlobalState<State>;

    constructor(initialState: State) {
        this._globalState = new GlobalState<State>(initialState);
    }

    protected get _state() {
        return this._globalState.state;
    }

    /**
     * Use only when strictly necessary, prefer withState() instead
     */
    public get ContextConsumer() {
        return this._globalState.ContextConsumer;
    }

    protected _updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        return this._globalState.updateState(stateUpdate);
    }

    public withProvider(Component: typeof React.Component<any, any>) {
        return this._globalState.withProvider(Component);
    }

    public withState(Component: typeof React.Component<any, any>) {
        return this._globalState.withState(Component);
    }
}

export default GlobalStateController;
