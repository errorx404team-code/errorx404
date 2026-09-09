IBM Bob Integration - ErrorX404 Legacy Modernization Platform

How IBM Bob Was Used as an AI Engineering Assistant During Development

This document is organized around one thing: the exact prompt given to IBM Bob, and what Bob actually did with it. Each entry below follows the same structure - Prompt given to Bob, then What Bob did. This is meant to make Bob's contribution traceable, so anyone reading this can see the input and the resulting output side by side.


1. Overview

ErrorX404 is an AI powered, browser based legacy code modernization platform, built on a React and Vite frontend, a FastAPI backend, a SQLite database, and a twelve stage conversion pipeline. IBM Bob was used throughout development as an on demand engineering assistant. Whenever the team hit a specific technical question, a bug, or a design decision that needed a second opinion, a prompt was written describing the exact code context and the exact problem, and given to Bob. Bob's response was then used to move the work forward.

The structure below lists, for each piece of work, the prompt given and what Bob did with it.


2. Prompt to Bob, and What Bob Did


Entry 1 - Pipeline module structure at app startup

Prompt given to IBM Bob
"I am building a FastAPI backend for a legacy code modernization pipeline. I have four pipeline stages implemented as classes: SpecAnalyzer, DependencyBuilder, BusinessPartitioner, and CodeConverter. Each class has methods like analyze(source_code) and convert(spec_json, target_language) that take all their inputs as parameters and return a result object, with no instance attributes set between calls. I am planning to instantiate each class once at module level in main.py and reuse the same instance across every request, instead of creating a new instance per request. Is this safe under FastAPI's async request handling model, and are there any concurrency issues I should watch for if two requests hit the same instance at the same time?"

What IBM Bob did
Bob reviewed the described class design and confirmed that module level singleton instances are safe in FastAPI as long as no per request state is stored on the instance itself. Bob explained that FastAPI can serve concurrent requests through the same singleton, so any shared mutable attribute set during one request could leak into another, and that the described design, where every method takes its inputs as arguments and returns a fresh result object, avoids this problem entirely. Bob also flagged that if any future pipeline stage needs to cache something between calls, for example a loaded ML model, it should be stored as a read only attribute set once at startup, not written to during request handling.

Result
SpecAnalyzer, DependencyBuilder, BusinessPartitioner, and CodeConverter are instantiated once in main.py and reused across every request, with each method staying stateless as described in the prompt.


Entry 2 - MUMPS global variable regex versus routine call targets

Prompt given to IBM Bob
"I am parsing MUMPS source code in Python. I am using the regex pattern \^([A-Z0-9%\(]+) to detect global variable references like ^DPT or ^AUTTLOC. The problem is this same pattern also matches the routine name in external calls like DO TAG^ROUTINE, D ^PSRX, GOTO ^LBL7, and $$TAG^ROUTINE, where the part after the caret is a routine name, not a global. I want to exclude any caret match that is immediately preceded by DO, D, GOTO, G, or a double dollar sign, ignoring the tag name and any whitespace in between. Can I do this with a single negative lookbehind in Python's re module, or is there a cleaner way to separate these two cases?"

What IBM Bob did
Bob explained that a single lookbehind covering DO TAG^ROUTINE is difficult because the tag name between DO and the caret has variable length, and Python's re module requires lookbehinds to have a fixed width. Bob recommended a two pass approach instead: first run a separate regex to extract every external call target, matching patterns like DO\s+\w*\^(\w+), D\s+\w*\^(\w+), GOTO\s+\w*\^(\w+), G\s+\w*\^(\w+), and \$\$\w*\^(\w+), collecting the routine names into a set called routine_calls. Then run the global detection regex as before, but for every match, check if the matched name is in routine_calls, and skip it if so. Bob noted this is more maintainable than one large regex because each call type can be tuned independently, and because the exclusion logic is explicit rather than buried inside a lookbehind.

Result
mumps_adapter.py extracts routine_calls in an earlier pass and the global detection logic checks against that set before accepting a caret match as a global variable.


Entry 3 - Custom exception design for the Gemini API wrapper

Prompt given to IBM Bob
"I am writing a wrapper around the Gemini API in llm_provider.py. I want a custom exception class GeminiAPIError(Exception) that stores an extra attribute, error_category, a string like RATE_LIMIT, AUTH_ERROR, or TIMEOUT, set through the constructor alongside the normal message. When a real API key is configured and the Gemini call fails, I want this exception to propagate all the way up through analyzer.py to the FastAPI route handler, where it should not be silently caught, so the client gets a 503 rather than a fallback response. When no key is configured, no exception should be raised, a static fallback should be used instead. What is the cleanest way to define this exception, and where exactly should the try except boundaries sit across llm_provider.py, analyzer.py, and the route handler?"

What IBM Bob did
Bob showed the exception definition, a class inheriting from Exception with an __init__ that calls super().__init__(message) and then sets self.error_category = error_category. Bob confirmed the boundary placement: llm_provider.py should raise GeminiAPIError on any Gemini failure when a real key is configured, analyzer.py should not catch it at all, and the FastAPI route handler is the correct place to either catch it explicitly and raise HTTPException(status_code=503, detail=str(exc)), or leave it unhandled so FastAPI's default 500 handler takes over. Bob recommended catching it explicitly to get the correct 503 status code, since an uncaught exception defaults to 500. Bob also suggested adding an inline comment in analyzer.py at the point where the LLM call happens, stating that GeminiAPIError is expected to propagate, so a future maintainer does not add a try except there by mistake.

Result
GeminiAPIError is defined with the error_category attribute in llm_provider.py, propagates uncaught through analyzer.py, and is caught at the route handler level to return a 503, exactly as scoped in the prompt.


Entry 4 - Weighted confidence scoring formula and edge case behavior

Prompt given to IBM Bob
"I need a weighted confidence score from 0 to 100 for AI converted Python code, based on five inputs I already compute per file: pass_rate (fraction of tests that passed, 0 to 1), syntax_valid (boolean, code compiles), execution_reliability (fraction of tests that ran without an unhandled exception), integration_score (fraction of dependency and interface checks that passed), and coverage_count (number of distinct test cases that exist for the file). Test pass rate should dominate the formula since it is the strongest signal of correctness. Propose specific weights that sum to 100, and then walk through what the score comes out to in four cases: every test passes, every test fails, there are zero tests for the file, and there is exactly one test and it passes. I specifically want to know if the zero test case produces a misleadingly high score just from syntax and integration checks alone."

What IBM Bob did
Bob proposed pass_rate at 60 percent, syntax_valid at 15 percent, execution_reliability at 10 percent, integration_score at 10 percent, and a coverage bonus at 5 percent, all summing to 100. Bob then walked the four cases: all tests passing gives close to 100 assuming syntax and integration also pass; all tests failing gives roughly 25, from syntax and integration alone, since pass_rate, execution_reliability, and the coverage bonus all read as zero; a file with zero tests would, under the raw formula, still get around 25 from syntax_valid and integration_score, which Bob flagged as misleading, since a file that was never actually exercised should not read as 25 percent confident; and a single passing test gives a high score close to the all pass case, which Bob noted is expected but worth flagging separately in the UI as "based on 1 test" so reviewers do not mistake it for broad coverage. Bob's fix for the zero test case was an explicit guard, if no_test_tests == total_tests, force pass_rate, execution_reliability, and the coverage bonus to zero before applying the weights, so a completely untested file scores near zero instead of 25.

Result
scorer.py implements the five weighted components with the exact weights above, plus the no_test_tests == total_tests guard that zeroes out the relevant components, and the five confidence tier labels shown to the reviewer.


Entry 5 - Computing MUMPS $HOROLOG and detecting dynamic timestamp fields

Prompt given to IBM Bob
"MUMPS has a system variable $HOROLOG that returns the current date and time as two comma separated integers, days,seconds, where days counts up from December 31, 1840, and seconds is the number of seconds since midnight, 0 to 86399. I need a Python function that returns today's value in that exact format. Separately, I am writing test verification logic where some expected test outputs are actual $HOROLOG values that were captured when the test was written, and will not match today's value in a straight string comparison. I need a function is_dynamic_horolog_expected(value) that returns True if a given expected value looks like a $HOROLOG timestamp rather than a fixed string constant, so the verifier can compare it dynamically instead of doing exact string matching. What logic should that detection function use, both for symbolic markers and for the raw days,seconds format?"

What IBM Bob did
Bob gave the date computation as delta = date.today() - date(1840, 12, 31), followed by f"{delta.days},{seconds_since_midnight}" for the days,seconds string. For the detection function, Bob laid out three checks: first, treat known symbolic markers such as the literal strings "$HOROLOG" or "TODAY" as always dynamic; second, for a raw days,seconds string, split on the comma, confirm both parts parse as integers, and confirm the seconds part is between 0 and 86399; third, and this was the key addition, check the days value itself, if it is above roughly 1000, which corresponds to a MUMPS date well past the mid 1840s, it is almost certainly a real captured date rather than a small hand written test constant like "5,100", and should be treated as dynamic for that reason alone even without a symbolic marker. Bob suggested wrapping all of this in a single is_horolog_format(value) helper that accepts both a two element list or tuple and a comma joined string, so callers do not need to know the exact representation used elsewhere in the codebase.

Result
verifier.py implements the horolog computation function and is_dynamic_horolog_expected, including the 1000 day threshold and the symbolic marker check, both taken directly from this guidance.


Entry 6 - Safe SQLite column migration without Alembic

Prompt given to IBM Bob
"I am using SQLAlchemy with a SQLite database that already has real data in it from testing. I need to add several new columns to existing tables, for example file_action on the routines table and conversion_source on the conversions table. I do not want to introduce Alembic for this. SQLAlchemy's Base.metadata.create_all() does not alter existing tables, so I need to run raw ALTER TABLE ADD COLUMN statements on startup, but only for columns that do not already exist, since running it twice would error out. Show me the pattern for checking existing columns with PRAGMA table_info before adding, and how to structure this so it is safe to run on every single server startup without risk to existing rows."

What IBM Bob did
Bob showed a helper, _sqlite_columns(conn, table_name), that runs PRAGMA table_info(table_name) and returns the set of existing column names from the result rows. Bob then showed the migration pattern: for each (table, column_name, column_type_and_default) to add, call _sqlite_columns first, and only run ALTER TABLE {table} ADD COLUMN {column_name} {type_and_default} if the column name is not already in that set. Bob wrapped each ALTER TABLE call in its own try except so that one unexpected failure, for example a locked database, does not prevent the remaining columns from being added in the same startup pass. Bob was explicit that ALTER TABLE ADD COLUMN in SQLite is additive only, it cannot drop or modify existing columns or rows, which is what makes it safe to run unconditionally on every startup as long as the existence check is in place first.

Result
database.py has ensure_new_columns(), which calls the _sqlite_columns() and _sqlite_tables() helpers and runs the guarded ALTER TABLE statements for every new column across the routines, conversions, and confidence_scores tables, run automatically on every startup.


Entry 7 - React prop structure and reviewer notes state for the review panel

Prompt given to IBM Bob
"I am building a React component, HumanReviewPanel, that needs seven pieces of data from its parent, App.jsx: the active routine object, the conversion result, verification data, confidence score data, generated documentation, explainability data, and the existing review decision if one exists. The component also needs an editable text area for reviewer notes, and Approve and Reject buttons. Two design questions: should App.jsx pass these seven pieces of data as one bundled object prop or as seven separate named props, and should the reviewer notes be stored as state inside HumanReviewPanel itself, with the final value passed up through onApprove(notes) and onReject(notes), or should the parent own the notes state and pass a value plus an onChange handler down?"

What IBM Bob did
Bob recommended seven separate named props over one bundled object, explaining that a bundled object hides which specific piece of data changed when App.jsx re-renders, making it harder to reason about why the component updates, and making future prop additions or removals less explicit at the call site. For the reviewer notes, Bob recommended keeping them as local state inside HumanReviewPanel using useState(''), since the notes are purely an input the panel is collecting and do not need to exist anywhere else in the app until the reviewer actually submits. Bob's suggested flow was to call onApprove(reviewerNotes) and onReject(reviewerNotes) directly from the button handlers, passing the current local state value as an argument at the moment of submission, so the parent only receives the notes once there is an actual action to take. Bob added that a useEffect watching the reviewDecision prop should reset the local notes state to reviewDecision?.reviewer_notes whenever the decision prop changes, so switching to a routine that already has a review does not show stale notes from the previous routine.

Result
HumanReviewPanel.jsx takes activeRoutine, conversion, verificationData, confidenceData, documentationData, explainabilityData, and reviewDecision as separate props, manages reviewerNotes locally with useState, passes the notes into onApprove and onReject at submission time, and includes the useEffect that resyncs notes whenever reviewDecision changes.


Entry 8 - FastAPI dependency injection pattern for database sessions

Prompt given to IBM Bob
"I have SessionLocal = sessionmaker(bind=engine) set up for SQLAlchemy against a SQLite database, created with connect_args={'check_same_thread': False}. I want every FastAPI route handler to receive a database session automatically through Depends(), with the session guaranteed to close when the request finishes, even if the handler raises an exception partway through. What should the get_db function look like, and does check_same_thread False actually create any real thread safety risk given how FastAPI and SQLAlchemy sessions interact?"

What IBM Bob did
Bob wrote get_db as a generator function: it creates db = SessionLocal(), then has a try block with yield db, followed by a finally block with db.close(), so the session is returned to the route handler on yield and is guaranteed to close afterward regardless of whether the handler completes normally or raises. Bob explained that FastAPI's dependency system automatically runs the code after yield once the request is done, which is what makes this pattern safe for cleanup. On the check_same_thread question, Bob clarified that this flag only affects the raw sqlite3 connection object underneath, not the SQLAlchemy Session, and that since FastAPI can process a request on a different worker thread than the one that opened the connection, check_same_thread False is required, but the actual safety in this setup comes from each request getting its own fresh Session and closing it at the end, not from any manual locking.

Result
get_db() in database.py follows exactly this try, yield, finally pattern, and every route handler in main.py declares db: Session = Depends(get_db).


Entry 9 - Tracing why the converter silently falls back to demo output

Prompt given to IBM Bob
"In converter.py, when no Gemini API key is configured, my intended flow is: try the static MUMPS to Python transpiler first, and only use hardcoded demo output if the transpiler itself raises or fails validation. I am seeing some converted files come back as demo output even for MUMPS input that the transpiler should be able to handle correctly. Here is the relevant section of converter.py [transpiler call, is_valid check, and the surrounding try except that falls through to demo output]. Can you trace through this and tell me what specific condition would cause the demo fallback to trigger even when the transpiler technically produced output?"

What IBM Bob did
Bob walked through the described control flow and identified that the transpiler's own is_valid flag was being set to False for certain MUMPS input patterns even though the transpiler still produced usable Python output with a warning comment prefixed to it, and that the surrounding try except block was treating is_valid == False as equivalent to a hard failure, catching that as an exception path and falling through to the demo fallback, when in fact the transpiler had succeeded with caveats rather than failed outright. Bob recommended adding a log statement immediately after the is_valid check to print the actual is_valid value and any warning text, to confirm this was the exact trigger before changing anything. Bob then recommended treating transpiler output that has warnings as still valid, returned with the TRANSPILER conversion source and the warnings attached as metadata, reserving the DEMO_FALLBACK path strictly for cases where the transpiler itself raises an exception or produces no output at all.

Result
The developer added the suggested logging, confirmed the exact is_valid trigger condition Bob described, and updated converter.py so transpiler output with warnings is returned under CONVERSION_SOURCE_TRANSPILER instead of falling through to demo output. The conversion_source constants, REAL_GEMINI, TRANSPILER, DEMO_FALLBACK, and FAILED, are documented in converter.py as a direct result of this trace.


Entry 10 - Response shape for a workspace level verification endpoint with no data yet

Prompt given to IBM Bob
"I am implementing POST /api/projects/{workspace_id}/verify in FastAPI. It should look at every routine in the given workspace, check whether each has a conversion and a confidence score, and return an aggregate status of VERIFIED, NEEDS_REVIEW, or FAILED. The case I am unsure about is a workspace where routines exist but none of them have been converted yet, should this return 404, a 422 validation error, or 200 with some kind of not-yet-verified status? Also, what is the right way in SQLAlchemy to walk from a list of Routine rows filtered by workspace_id, through their related Conversion rows, to each one's ConfidenceScore, given that Routine to Conversion and Conversion to ConfidenceScore are both already defined as ORM relationships in models.py?"

What IBM Bob did
Bob argued against 404, reasoning that a 404 on this endpoint would incorrectly imply the workspace_id itself does not exist, when the actual situation is that the workspace exists but has no conversion activity yet, a meaningfully different state that the frontend needs to distinguish and render differently, for example showing a "run your first conversion" prompt instead of a generic not found page. Bob recommended 200 with a project_status field set to a specific value like "NOT_VERIFIED", alongside whatever partial data does exist, such as the routine count. On the query, Bob recommended against writing a manual multi table JOIN, and instead suggested loading the Routine rows filtered by workspace_id with a normal query, then for each routine iterating routine.conversions, since that relationship was already defined, and for each conversion reading conversion.confidence_score directly, since that relationship was also already defined, letting SQLAlchemy handle the underlying joins lazily rather than duplicating that logic in a raw query.

Result
The endpoint returns 200 with project_status set to NOT_VERIFIED when no conversions exist yet, and project_verifier.py walks routine.conversions and conversion.confidence_score through the existing ORM relationships rather than a hand written join.


Entry 11 - Using the POST response directly versus a follow up GET

Prompt given to IBM Bob
"ProjectVerifyPanel.jsx calls POST /api/projects/{id}/verify when the user clicks a Verify button, and the JSON response already contains the full, freshly computed verification result. After the POST resolves, should I call setProjectData directly with that response body, or should I always trigger a separate GET /api/projects/{id}/verify right after to re-fetch, just to be safe? This is a single user local tool, not a multi client system. Also, what is the right place to manage an isVerifying loading flag so it does not get stuck true if the request fails?"

What IBM Bob did
Bob said using the POST response body directly is correct here and is strictly better for this case, since firing an additional GET afterward would only be justified if some other process could have modified the same resource between the POST and the GET, which does not apply in a single user local tool, so the extra GET would only add a redundant round trip with no benefit. Bob recommended setting isVerifying to true immediately before the POST call, and clearing it inside a finally block that runs whether the request resolves or rejects, so a network failure or a non 200 response cannot leave the UI stuck in a loading state.

Result
ProjectVerifyPanel.jsx calls setProjectData(data) directly from the POST response, and isVerifying is set before the call and cleared in a finally block.


Entry 12 - Pydantic v2 default value behavior with an explicit None from the ORM

Prompt given to IBM Bob
"I have a Pydantic v2 schema field, conversion_source: Optional[str] = 'UNKNOWN', on my ConversionResponse model. This is populated from a SQLAlchemy ORM object using from_attributes, and older rows in the database have NULL in the conversion_source column, which SQLAlchemy reads back as None. When Pydantic builds the response from an ORM object where conversion_source is explicitly None, does it fall back to the 'UNKNOWN' default, or does it just pass None straight through to the API response?"

What IBM Bob did
Bob explained that in Pydantic v2, a field's default value is only substituted when the field is entirely absent from the input data being validated, and that an ORM attribute which is explicitly None counts as present with the value None, not as absent, so Pydantic passes None straight through rather than substituting 'UNKNOWN'. Bob said the two real options are a field_validator that maps None to 'UNKNOWN' at the schema layer, or ensuring the value is never None in the first place by fixing it at the point of database writes, and that the second option is usually preferable when the field represents something that should always have a meaningful value going forward.

Result
The developer chose to fix it at the write path rather than add a validator, ensuring conversion_source is always set to one of REAL_GEMINI, TRANSPILER, DEMO_FALLBACK, or FAILED whenever a Conversion row is created, so a NULL value never has to be handled by the schema layer at all.


3. What This Shows

Across these twelve entries, the pattern is consistent. A specific, technically detailed prompt was written, including the actual code context, the actual symptom or design question, and the actual constraint the developer was working within. Bob responded with a concrete technical explanation and a specific recommendation, not a generic answer. The developer then implemented that recommendation, and in every case the resulting code in the repository, the file and function names listed above, traces directly back to the guidance in that entry.

Bob did not write the files. Bob answered the exact question it was asked, based on the exact context it was given, and the developer took that answer and built the actual implementation. The prompts shown above are the actual class of prompts used, they name real files, real function names, and real symptoms encountered during this project, not generic or templated questions.


4. Developer Responsibilities vs IBM Bob Responsibilities

Writing and integrating every file in the repository: developer.
Deciding the overall architecture, FastAPI, SQLite, React, the twelve stage pipeline: developer.
Writing the prompt that describes the exact problem and context: developer.
Reading that context and producing a specific technical explanation and recommendation: IBM Bob.
Choosing which recommendation to follow when more than one option was given: developer.
Implementing the chosen approach in the actual codebase: developer.
Testing and validating that the implementation works: developer.

Bob's part in this project is fully represented by the twelve prompt and response pairs above, and by the smaller set of representative prompts in the appendix below. Nothing beyond what is shown in those exchanges was contributed by Bob.


Appendix - Additional Representative Prompts Given to IBM Bob

"The Vite dev server config has a proxy rule forwarding any request path starting with /api to http://localhost:8000. FastAPI also has CORSMiddleware configured with allow_origins set to the Vite dev server's origin. Given that the proxy makes requests to /api same origin from the browser's perspective, is the CORS middleware still doing anything in local development, or is it only relevant once the frontend and backend are deployed to different origins in production?"

"I have a workspace_id column on the Routine table, and I am adding an endpoint that needs to compute stats only for one workspace at a time. If I write db.query(Routine).filter(Routine.workspace_id == workspace_id).all(), and then join to Conversion and ConfidenceScore through the existing relationships, is there any way a routine from a different workspace could leak into the result, for example through a many to many relationship I am not accounting for?"

"sandbox_runner.py needs to figure out which method to call on a dynamically generated Python class, when the class might have several public methods and the test case only provides a function name string and a list of input arguments. What is a reliable way to match the function name string to the right method using getattr, and what should happen if getattr does not find a matching method, should that be a NO_TEST result or an ERROR result?"

"In scorer.py, all five score components are floats between 0 and 1, multiplied by their weights which sum to 100. Is there any floating point scenario where the final sum could round to slightly above 100 or slightly below 0, for example due to repeated multiplication and addition of numbers like 0.1 that are not exactly representable in binary floating point, and if so should I clamp the final result with max(0, min(100, score))?"

"In SQLAlchemy, if I declare confidence_score as a relationship on Conversion with uselist=False, meaning I expect at most one ConfidenceScore row per Conversion, but a bug elsewhere in the code inserts two ConfidenceScore rows with the same conversion_id foreign key, what actually happens when I access conversion.confidence_score, does SQLAlchemy raise an error, or does it silently return one of the two rows without telling me there were two?"