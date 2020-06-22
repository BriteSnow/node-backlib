
/**
 * Tracker to determine if a decorator is on the leaf"est" method of the class hierarchy.
 */
export function newLeafTracer() {
	return new LeafTracer();
}

type LeafTargetClassByProperty = Map<string, Function>;

/**
 * Ter
 */
class LeafTracer {

	// object class, by TopTarget
	private dic: Map<Function, LeafTargetClassByProperty> = new Map();

	/** Returns true if this method is the leaf most method annotatio traced by this tracer */
	trace(objectClass: Function, targetClass: Function, propertyKey: string) {

		let topTargetClassByProperty = this.dic.get(objectClass);

		// if no topTargetChassByProperty, then, this targetCalss is the top one for this objectClass
		// so create the map and return true
		if (!topTargetClassByProperty) {
			topTargetClassByProperty = new Map<string, Function>();
			topTargetClassByProperty.set(propertyKey, targetClass);

			this.dic.set(objectClass, topTargetClassByProperty);
			return true;
		}
		// when topTargetClasByProperty
		else {
			let topTargetClass = topTargetClassByProperty.get(propertyKey);

			// if no topTargetClass, then, this targetClass is the top one
			// so we create the entry, and we return true
			if (!topTargetClass) {
				topTargetClassByProperty.set(propertyKey, targetClass);
				return true;
			}
			// otherwise, if we have a topTargetClass, return true if same as objectClass
			else {
				return (topTargetClass === targetClass);
			}
		}
	}
}