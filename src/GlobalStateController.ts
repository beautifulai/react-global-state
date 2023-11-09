import GlobalState, { BaseComponentType } from "./GlobalState";

class GlobalStateController<State> {
    protected _globalState: GlobalState<State>;

    constructor(initialState: State) {
        this._globalState = new GlobalState<State>(
            initialState,
            (prevState: State) => this._stateDidUpdate(prevState)
        );
    }

    protected get _state() {
        return this._globalState.state;
    }

    protected _updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        return this._globalState.updateState(stateUpdate);
    }

    public withState<T extends BaseComponentType>(Component: T) {
        return this._globalState.withState<T>(Component);
    }

    /**
     * Override if needed
     */
    protected _stateDidUpdate(prevState: State) {
    }
}

export default GlobalStateController;
