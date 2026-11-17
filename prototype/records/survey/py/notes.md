# survey notes py + rb
Q1 py MainEntity_py.ts:21-24 new each call (Cls(self,data)); rb MainEntity_rb.ts:21-23 new each call.
Q2 py client.options property live (Main.fragment.py:96-98), options_map clone (107-108), get_utility copy (113-114)
   rb attr_accessor :options live (Main.fragment.rb:21), options_map clone 85-87, get_utility copy 90-91
Q7 test: classmethod py 353-354, rb def self.test 325
Q9 py direct _raw_request 233-309; rb raw_request 205-280 (rb rescues only ProjectNameError at 213)
Q1 NOTE accessor arg goes to entopts (ctor param 2), not data: py Entity.fragment.py:12 / rb :7. Old pages say "(data)".
Q3 py signal callable or .aborted (Entity.fragment.py:113-118), generator returns; rb lambda 130-135 throw :stream_stop
Q5 both lazy (py generator fn; rb Enumerator.new 140)
Q6 deleted() method; data replaced by resdata if not None (remove op post_done)
Q9 (d) err is a STRING (py fetcher.py:102-103 str(e); rb fetcher.rb:222-224)
Q10 optspec.ts:56-58 open feature map; factory fallback BaseFeature (Main_py.ts:191-195, rb else); test() mode=test -> fetcher fetch_mode_block
Q11 explain only dict/Hash (py context.py:53-54; rb context.rb:37); rb REFERENCE.md:97 says explain=>true
Q12 py pkg py/demo_sdk (utility_py.ts:11-12), rb Demo_sdk.rb at rb/ root, gemspec require_paths ["."]
DONE reading; all 12 + old-page contradictions answered; result returned in structured output.
