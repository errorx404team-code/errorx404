from app.adapters.mumps_adapter import MUMPSAdapter

class DependencyBuilder:
    def __init__(self):
        self.adapter = MUMPSAdapter()

    def build_graph(self, raw_code: str, routine_name: str = "ROUTINE"):
        """
        Module 1b: Dependency Graph Generator
        Parses calls, globals, and subroutines into nodes and edges.
        """
        graph_data = self.adapter.extract_dependencies(raw_code)
        return graph_data
