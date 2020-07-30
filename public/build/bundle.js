
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                info.blocks[i] = null;
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/screens/Welcome.svelte generated by Svelte v3.23.2 */
    const file = "src/screens/Welcome.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (40:4) {#each categories as category}
    function create_each_block(ctx) {
    	let button;
    	let t_value = /*category*/ ctx[5].label + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[3](/*category*/ ctx[5], ...args);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			button.disabled = /*selected*/ ctx[0];
    			add_location(button, file, 40, 8, 1034);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*selected*/ 1) {
    				prop_dev(button, "disabled", /*selected*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(40:4) {#each categories as category}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let header;
    	let h1;
    	let t0;
    	let span;
    	let t2;
    	let t3;
    	let p0;
    	let t4;
    	let a;
    	let t6;
    	let t7;
    	let p1;
    	let t9;
    	let p2;
    	let t11;
    	let div;
    	let each_value = /*categories*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			t0 = text("CameoP");
    			span = element("span");
    			span.textContent = "a";
    			t2 = text("rison");
    			t3 = space();
    			p0 = element("p");
    			t4 = text("On ");
    			a = element("a");
    			a.textContent = "cameo.com";
    			t6 = text(", you can buy personalised video clips from everyone from Lindsay Lohan to Ice T.");
    			t7 = space();
    			p1 = element("p");
    			p1.textContent = "But who commands the highest price?";
    			t9 = space();
    			p2 = element("p");
    			p2.textContent = "Pick a category to play a game:";
    			t11 = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(span, "class", "logo svelte-1fhxxll svelte-1fmoh9f");
    			add_location(span, file, 26, 14, 654);
    			attr_dev(h1, "class", "svelte-1fmoh9f");
    			add_location(h1, file, 25, 4, 635);
    			attr_dev(a, "href", "https://cameo.com");
    			add_location(a, file, 30, 11, 733);
    			attr_dev(p0, "class", "svelte-1fmoh9f");
    			add_location(p0, file, 29, 4, 718);
    			attr_dev(p1, "class", "svelte-1fmoh9f");
    			add_location(p1, file, 33, 4, 871);
    			add_location(header, file, 24, 0, 622);
    			attr_dev(p2, "class", "svelte-1fmoh9f");
    			add_location(p2, file, 36, 0, 925);
    			attr_dev(div, "class", "categories");
    			add_location(div, file, 38, 0, 965);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			append_dev(h1, t0);
    			append_dev(h1, span);
    			append_dev(h1, t2);
    			append_dev(header, t3);
    			append_dev(header, p0);
    			append_dev(p0, t4);
    			append_dev(p0, a);
    			append_dev(p0, t6);
    			append_dev(header, t7);
    			append_dev(header, p1);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, p2, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*selected, select, categories*/ 7) {
    				each_value = /*categories*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(p2);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let selected = false;

    	const select = category => {
    		$$invalidate(0, selected = true);
    		dispatch("select", { category });
    	};

    	const categories = [
    		{ slug: "actors", label: "Actors" },
    		{ slug: "athletes", label: "Athletes" },
    		{ slug: "comedians", label: "Comedians" },
    		{ slug: "creators", label: "Creators" },
    		{ slug: "models", label: "Models" },
    		{ slug: "musicians", label: "Musicians" },
    		{ slug: "reality-tv", label: "Reality TV" }
    	];

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Welcome> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Welcome", $$slots, []);
    	const click_handler = category => select(category);

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		selected,
    		select,
    		categories
    	});

    	$$self.$inject_state = $$props => {
    		if ("selected" in $$props) $$invalidate(0, selected = $$props.selected);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [selected, select, categories, click_handler];
    }

    class Welcome extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Welcome",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/components/Card.svelte generated by Svelte v3.23.2 */
    const file$1 = "src/components/Card.svelte";

    function create_fragment$1(ctx) {
    	let div1;
    	let button;
    	let div0;
    	let h2;
    	let a;
    	let t0_value = /*celeb*/ ctx[0].name + "";
    	let t0;
    	let a_href_value;
    	let t1;
    	let p;
    	let t2_value = /*celeb*/ ctx[0].type + "";
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			button = element("button");
    			div0 = element("div");
    			h2 = element("h2");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "href", a_href_value = "https://cameo.com/" + /*celeb*/ ctx[0].id);
    			add_location(a, file$1, 13, 16, 367);
    			attr_dev(h2, "class", "svelte-7d64sf");
    			add_location(h2, file$1, 12, 12, 346);
    			attr_dev(p, "class", "type svelte-7d64sf");
    			add_location(p, file$1, 15, 12, 469);
    			attr_dev(div0, "class", "details svelte-7d64sf");
    			add_location(div0, file$1, 11, 8, 312);
    			attr_dev(button, "class", "card-inner svelte-7d64sf");
    			set_style(button, "background-image", "url(" + /*celeb*/ ctx[0].image + ")");
    			add_location(button, file$1, 8, 4, 170);
    			attr_dev(div1, "class", "card-outer svelte-7d64sf");
    			add_location(div1, file$1, 7, 0, 141);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button);
    			append_dev(button, div0);
    			append_dev(div0, h2);
    			append_dev(h2, a);
    			append_dev(a, t0);
    			append_dev(div0, t1);
    			append_dev(div0, p);
    			append_dev(p, t2);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*celeb*/ 1 && t0_value !== (t0_value = /*celeb*/ ctx[0].name + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*celeb*/ 1 && a_href_value !== (a_href_value = "https://cameo.com/" + /*celeb*/ ctx[0].id)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*celeb*/ 1 && t2_value !== (t2_value = /*celeb*/ ctx[0].type + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*celeb*/ 1) {
    				set_style(button, "background-image", "url(" + /*celeb*/ ctx[0].image + ")");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { celeb } = $$props;
    	const dispatch = createEventDispatcher();
    	const writable_props = ["celeb"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Card", $$slots, []);
    	const click_handler = () => dispatch("select");

    	$$self.$set = $$props => {
    		if ("celeb" in $$props) $$invalidate(0, celeb = $$props.celeb);
    	};

    	$$self.$capture_state = () => ({ createEventDispatcher, celeb, dispatch });

    	$$self.$inject_state = $$props => {
    		if ("celeb" in $$props) $$invalidate(0, celeb = $$props.celeb);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [celeb, dispatch, click_handler];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { celeb: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*celeb*/ ctx[0] === undefined && !("celeb" in props)) {
    			console.warn("<Card> was created without expected prop 'celeb'");
    		}
    	}

    	get celeb() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set celeb(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function pick_random(array) {
    	const index = Math.floor(array.length * Math.random());
    	return array[index];
    }

    function sleep(ms) {
    	return new Promise(fulfil => {
    		setTimeout(fulfil, ms);
    	});
    }

    const ROUNDS_PER_GAME = 10;

    function remove(array, index) {
    	// if a 'similar' account was picked, there's no
    	// guarantee that it's in the filtered array
    	if (index === -1) return;

    	// this is much faster than splicing the array
    	array[index] = array[array.length - 1];
    	array.pop();
    }

    function select(celebs, lookup, category) {
    	const filtered = celebs.filter(c => {
    		return c.categories.includes(category);
    	});

    	const seen = new Set();
    	const selection = [];

    	let i = ROUNDS_PER_GAME;
    	while (i--) {
    		const n = Math.random();
    		const ai = Math.floor(n * filtered.length);
    		const a = filtered[ai];

    		// remove a from the array so this person can't be picked again
    		remove(filtered, ai);

    		let b;

    		// if this celeb has 'similar' celebs, decide whether to pick one
    		const similar = a.similar.filter(id => !seen.has(id));
    		if ((similar.length > 0) && (Math.random() < 0.75)) {
    			const id = pick_random(similar);
    			b = lookup.get(id);
    		}

    		// otherwise pick someone at random
    		else {
    			b = pick_random(filtered);
    		}

    		selection.push({ a, b });

    		seen.add(a.id);
    		seen.add(b.id);

    		// remove b from the array so this person can't be picked again
    		remove(filtered, filtered.indexOf(b));
    	}

    	return selection;
    }

    /* src/screens/Game.svelte generated by Svelte v3.23.2 */

    const { console: console_1 } = globals;
    const file$2 = "src/screens/Game.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    function get_then_context(ctx) {
    	ctx[13] = ctx[15][0];
    	ctx[14] = ctx[15][1];
    }

    // (69:4) {:catch}
    function create_catch_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Failed to load data";
    			attr_dev(p, "class", "error svelte-1hs2gmd");
    			add_location(p, file$2, 69, 12, 1782);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(69:4) {:catch}",
    		ctx
    	});

    	return block;
    }

    // (47:35)          <div class="game">             <div class="card-container">                 <Card                      celeb={a}
    function create_then_block(ctx) {
    	get_then_context(ctx);
    	let div3;
    	let div0;
    	let card0;
    	let t0;
    	let div1;
    	let button;
    	let t2;
    	let div2;
    	let card1;
    	let current;
    	let mounted;
    	let dispose;

    	function select_handler(...args) {
    		return /*select_handler*/ ctx[6](/*a*/ ctx[13], /*b*/ ctx[14], ...args);
    	}

    	card0 = new Card({
    			props: { celeb: /*a*/ ctx[13] },
    			$$inline: true
    		});

    	card0.$on("select", select_handler);

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[7](/*a*/ ctx[13], /*b*/ ctx[14], ...args);
    	}

    	function select_handler_1(...args) {
    		return /*select_handler_1*/ ctx[8](/*a*/ ctx[13], /*b*/ ctx[14], ...args);
    	}

    	card1 = new Card({
    			props: { celeb: /*b*/ ctx[14] },
    			$$inline: true
    		});

    	card1.$on("select", select_handler_1);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			create_component(card0.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "Same Price";
    			t2 = space();
    			div2 = element("div");
    			create_component(card1.$$.fragment);
    			attr_dev(div0, "class", "card-container svelte-1hs2gmd");
    			add_location(div0, file$2, 48, 12, 1210);
    			attr_dev(button, "class", "same");
    			add_location(button, file$2, 56, 16, 1419);
    			attr_dev(div1, "class", "svelte-1hs2gmd");
    			add_location(div1, file$2, 55, 12, 1397);
    			attr_dev(div2, "class", "card-container svelte-1hs2gmd");
    			add_location(div2, file$2, 61, 12, 1563);
    			attr_dev(div3, "class", "game svelte-1hs2gmd");
    			add_location(div3, file$2, 47, 8, 1179);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			mount_component(card0, div0, null);
    			append_dev(div3, t0);
    			append_dev(div3, div1);
    			append_dev(div1, button);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			mount_component(card1, div2, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const card0_changes = {};
    			if (dirty & /*i*/ 2) card0_changes.celeb = /*a*/ ctx[13];
    			card0.$set(card0_changes);
    			const card1_changes = {};
    			if (dirty & /*i*/ 2) card1_changes.celeb = /*b*/ ctx[14];
    			card1.$set(card1_changes);
    			get_then_context(ctx);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card0.$$.fragment, local);
    			transition_in(card1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card0.$$.fragment, local);
    			transition_out(card1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(card0);
    			destroy_component(card1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(47:35)          <div class=\\\"game\\\">             <div class=\\\"card-container\\\">                 <Card                      celeb={a}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import Card from "../components/Card.svelte";     import { sleep }
    function create_pending_block(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(1:0) <script>     import Card from \\\"../components/Card.svelte\\\";     import { sleep }",
    		ctx
    	});

    	return block;
    }

    // (74:1) {#if last_result}
    function create_if_block_1(ctx) {
    	let img;
    	let img_alt_value;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "giant-result svelte-1hs2gmd");
    			attr_dev(img, "alt", img_alt_value = "" + (/*last_result*/ ctx[2] + " answer"));
    			if (img.src !== (img_src_value = "/icons/" + /*last_result*/ ctx[2] + ".svg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$2, 74, 4, 1867);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*last_result*/ 4 && img_alt_value !== (img_alt_value = "" + (/*last_result*/ ctx[2] + " answer"))) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*last_result*/ 4 && img.src !== (img_src_value = "/icons/" + /*last_result*/ ctx[2] + ".svg")) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(74:1) {#if last_result}",
    		ctx
    	});

    	return block;
    }

    // (85:12) {#if result}
    function create_if_block(ctx) {
    	let img;
    	let img_alt_value;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "alt", img_alt_value = "" + (/*result*/ ctx[10] + " answer"));
    			if (img.src !== (img_src_value = "/icons/" + /*result*/ ctx[10] + ".svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "svelte-1hs2gmd");
    			add_location(img, file$2, 85, 12, 2168);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*results*/ 1 && img_alt_value !== (img_alt_value = "" + (/*result*/ ctx[10] + " answer"))) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*results*/ 1 && img.src !== (img_src_value = "/icons/" + /*result*/ ctx[10] + ".svg")) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(85:12) {#if result}",
    		ctx
    	});

    	return block;
    }

    // (83:4) {#each results as result}
    function create_each_block$1(ctx) {
    	let span;
    	let t;
    	let if_block = /*result*/ ctx[10] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			span = element("span");
    			if (if_block) if_block.c();
    			t = space();
    			attr_dev(span, "class", "result svelte-1hs2gmd");
    			add_location(span, file$2, 83, 8, 2109);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (/*result*/ ctx[10]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(span, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(83:4) {#each results as result}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let header;
    	let p;
    	let t1;
    	let div0;
    	let promise_1;
    	let t2;
    	let t3;
    	let div1;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 15,
    		blocks: [,,,]
    	};

    	handle_promise(promise_1 = /*promise*/ ctx[3][/*i*/ ctx[1]], info);
    	let if_block = /*last_result*/ ctx[2] && create_if_block_1(ctx);
    	let each_value = /*results*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			header = element("header");
    			p = element("p");
    			p.textContent = "Tap on the more monetisable celebrity's face, or tap 'same price' if society values them equally.";
    			t1 = space();
    			div0 = element("div");
    			info.block.c();
    			t2 = space();
    			if (if_block) if_block.c();
    			t3 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(p, file$2, 42, 4, 990);
    			add_location(header, file$2, 41, 0, 977);
    			attr_dev(div0, "class", "game-container svelte-1hs2gmd");
    			add_location(div0, file$2, 45, 0, 1106);
    			attr_dev(div1, "class", "results svelte-1hs2gmd");
    			set_style(div1, "grid-template-columns", "repeat(" + /*results*/ ctx[0].length + ", 1fr)");
    			add_location(div1, file$2, 81, 0, 1988);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, p);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			info.block.m(div0, info.anchor = null);
    			info.mount = () => div0;
    			info.anchor = null;
    			insert_dev(target, t2, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*i*/ 2 && promise_1 !== (promise_1 = /*promise*/ ctx[3][/*i*/ ctx[1]]) && handle_promise(promise_1, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[15] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			if (/*last_result*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(t3.parentNode, t3);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*results*/ 1) {
    				each_value = /*results*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty & /*results*/ 1) {
    				set_style(div1, "grid-template-columns", "repeat(" + /*results*/ ctx[0].length + ", 1fr)");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div0);
    			info.block.d();
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { selection } = $$props;

    	const load_details = async celeb => {
    		const res = await fetch(`https://cameo-explorer.netlify.app/celebs/${celeb.id}.json`);
    		return await res.json();
    	};

    	const promise = selection.map(round => Promise.all([load_details(round.a), load_details(round.b)]));
    	const results = Array(selection.length);
    	let i = 0;
    	let last_result;

    	const submit = async (a, b, sign) => {
    		$$invalidate(2, last_result = Math.sign(a.price - b.price) === sign
    		? "right"
    		: "wrong");

    		console.log({ last_result });
    		await sleep(1500);
    		$$invalidate(0, results[i] = last_result, results);
    		$$invalidate(2, last_result = null);

    		if (i < selection.length - 1) {
    			$$invalidate(1, i += 1);
    		} // TODO end the game
    	};

    	const writable_props = ["selection"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Game", $$slots, []);
    	const select_handler = (a, b) => submit(a, b, 1);
    	const click_handler = (a, b) => submit(a, b, 1);
    	const select_handler_1 = (a, b) => submit(a, b, -1);

    	$$self.$set = $$props => {
    		if ("selection" in $$props) $$invalidate(5, selection = $$props.selection);
    	};

    	$$self.$capture_state = () => ({
    		Card,
    		sleep,
    		select,
    		selection,
    		load_details,
    		promise,
    		results,
    		i,
    		last_result,
    		submit
    	});

    	$$self.$inject_state = $$props => {
    		if ("selection" in $$props) $$invalidate(5, selection = $$props.selection);
    		if ("i" in $$props) $$invalidate(1, i = $$props.i);
    		if ("last_result" in $$props) $$invalidate(2, last_result = $$props.last_result);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		results,
    		i,
    		last_result,
    		promise,
    		submit,
    		selection,
    		select_handler,
    		click_handler,
    		select_handler_1
    	];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { selection: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*selection*/ ctx[5] === undefined && !("selection" in props)) {
    			console_1.warn("<Game> was created without expected prop 'selection'");
    		}
    	}

    	get selection() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selection(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.2 */
    const file$3 = "src/App.svelte";

    // (53:31) 
    function create_if_block_1$1(ctx) {
    	let game;
    	let current;

    	game = new Game({
    			props: { selection: /*selection*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(game.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(game, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const game_changes = {};
    			if (dirty & /*selection*/ 2) game_changes.selection = /*selection*/ ctx[1];
    			game.$set(game_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(game, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(53:31) ",
    		ctx
    	});

    	return block;
    }

    // (51:1) {#if state === 'welcome'}
    function create_if_block$1(ctx) {
    	let welcome;
    	let current;
    	welcome = new Welcome({ $$inline: true });
    	welcome.$on("select", /*start*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(welcome.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(welcome, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(welcome.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(welcome.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(welcome, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(51:1) {#if state === 'welcome'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$1, create_if_block_1$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*state*/ ctx[0] === "welcome") return 0;
    		if (/*state*/ ctx[0] === "playing") return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			if (if_block) if_block.c();
    			attr_dev(main, "class", "svelte-7f44mq");
    			add_location(main, file$3, 49, 0, 957);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(main, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let celebs_promise;
    	let state = "welcome"; // or playing
    	let selection;

    	const start = async e => {
    		const { celebs, lookup } = await celebs_promise;
    		$$invalidate(1, selection = select(celebs, lookup, e.detail.category.slug));
    		$$invalidate(0, state = "playing");
    	};

    	const load_celebs = async () => {
    		const res = await fetch("https://cameo-explorer.netlify.app/celebs.json");
    		const data = await res.json();
    		const lookup = new Map();

    		data.forEach(c => {
    			lookup.set(c.id, c);
    		});

    		const subset = new Set();

    		data.forEach(c => {
    			if (c.reviews >= 50) {
    				subset.add(c);

    				c.similar.forEach(id => {
    					subset.add(lookup.get(id));
    				});
    			}
    		});

    		return { celebs: Array.from(subset), lookup };
    	};

    	onMount(() => {
    		celebs_promise = load_celebs();
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		onMount,
    		Welcome,
    		Game,
    		select,
    		celebs_promise,
    		state,
    		selection,
    		start,
    		load_celebs
    	});

    	$$self.$inject_state = $$props => {
    		if ("celebs_promise" in $$props) celebs_promise = $$props.celebs_promise;
    		if ("state" in $$props) $$invalidate(0, state = $$props.state);
    		if ("selection" in $$props) $$invalidate(1, selection = $$props.selection);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [state, selection, start];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
