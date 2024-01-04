import GlobalState, { BaseComponentType } from "./GlobalState";

class GlobalStateController<State> {
    protected _globalState: GlobalState<State>;

    constructor(initialState: State) {
        this._globalState = new GlobalState<State>(
            initialState,
            (nextState: State) => this._stateWillUpdate(nextState),
            (prevState: State) => this._stateDidUpdate(prevState)
        );
    }

    protected get _state() {
        return this._globalState.state;
    }

    public get globalStateStats() {
        return this._globalState.stats;
    }

    protected _updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        return this._globalState.updateState(stateUpdate);
    }

    public withState<T extends BaseComponentType>(Component: T, stateKeys?: [keyof State, ...(keyof State)[]]) {
        return this._globalState.withState<T>(Component, stateKeys);
    }

    /**
     * Override if needed
     */
    protected _stateDidUpdate(prevState: State) {
    }

    /**
     * Override if needed, must return next state
     */
    protected _stateWillUpdate(nextState: State) {
        return nextState;
    }
}

export default GlobalStateController;
