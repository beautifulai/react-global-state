import GlobalState from "./GlobalState";

class GlobalStateController<State> {
    protected _globalState: GlobalState<State>;

    constructor(initialState: State) {
        this._globalState = new GlobalState<State>(initialState);
    }

    protected get _state() {
        return this._globalState.state;
    }

    protected _updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        return this._globalState.updateState(stateUpdate);
    }

    public withProvider(Component: React.FC<JSX.IntrinsicAttributes>) {
        return this._globalState.withProvider(Component);
    }

    public withState(Component: React.FC<JSX.IntrinsicAttributes>) {
        return this._globalState.withState(Component);
    }
}

export default GlobalStateController;
